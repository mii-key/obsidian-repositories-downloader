// Used to fetch community-plugins.json, may be changed to something different in future, like "got".
import fetch from "node-fetch";
import { download, extract } from "gitly";
import cliProgress from "cli-progress";
import ora from "ora";
import simpleGit from 'simple-git';
import path from 'path';
import { access, constants } from 'fs/promises';
import figures from 'figures';
import chalk from "chalk";
import fs from 'fs/promises';
import yargs from "yargs";


const URLS = {
  COMMUNITY_PLUGINS: "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json",
  GITHUB_RAWCONTENT: `https://raw.githubusercontent.com`
};

const repoBasePath = 'repositories';

const options = {
  // number of parallel git jobs
  jobCount: 10,
  // pull changes only if version if manifest has changed
  getOnlyNewVersion: true
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  }
  catch (err) {
    return false;
  }
}

/** Download repository and fallback to other branch if it doesn't use `master`. */
async function downloadRepo(repo) {
  let source;

  // Fallback to main branch if master doesn't work. The default in `gitly` is `master` and most Obsidian repositories use it.
  try {
    // Try to download from `master` branch.
    source = await download(repo, { throw: true });
  } catch (error) {
    // If not found, try to download from main brach. Else it's an other error.
    if (error.code === 404) {
      source = await download(`${repo}#main`, { throw: true });
    } else {
      console.error(error);
    }
  }

  await extract(source, path.join(repoBasePath, repo));
}

/** Downloads GitHub repositories that aren't already downloaded, creating a tree structure,
 * or pulls latest changes for existing repositories
 */
async function processRepositories(repos) {
  const progressBar = new cliProgress.SingleBar({
    format: "[{bar}] {percentage}% | {value}/{total} | 📂 {repo}",
    hideCursor: true,
  }, cliProgress.Presets.shades_classic);

  progressBar.start(repos.length, 0);

  const failedRepos = [];
  const newRepos = []
  const updatedRepos = [];

  while (repos.length) {
    let reposBatch = [];
    for (let i = 0; i < options.jobCount && repos.length; i++) {
      reposBatch.push(repos.pop());
    }

    let promisesGit = [];
    for (const repo of reposBatch) {
      const localRepoPath = path.join(repoBasePath, repo);

      const gitPromise = await exists(localRepoPath) ?
        // git pull
        (async () => {
          try {
            if (!(await shouldCheckForUpdates(repo))) {
              return;
            }
            const git = new simpleGit(localRepoPath);
            const { summary } = await git.pull();
            if (summary.changes || summary.deletions || summary.insertions) {
              updatedRepos.push({ repo, summary });
            }
          }
          catch (err) {
            failedRepos.push({ repo, err })
          }
          finally {
            progressBar.increment({ repo: repo });
          }
        })()
        // git clone
        : (async () => {
          try {
            const repoUrl = `https://github.com/${repo}.git`;
            await simpleGit().clone(repoUrl, localRepoPath);
            newRepos.push({ repo });
          }
          catch (err) {
            failedRepos.push({ repo, err })
            try {
              await fs.rm(localRepoPath, { recursive: true, force: true });
            }
            catch { }
          }
          finally {
            progressBar.increment({ repo: repo });
          }
        })();
      promisesGit.push(gitPromise);
    }
    await Promise.all(promisesGit);
  }
  progressBar.stop();

  return { newRepos, updatedRepos, failedRepos };
}

async function shouldCheckForUpdates(repo) {
  if (!options.getOnlyNewVersion) {
    return true;
  }
  const branches = ['main', 'master'];
  let branch;
  while ((branch = branches.pop()) != undefined) {
    try {
      const localManifestPath = `${repoBasePath}/${repo}/manifest.json`;
      if (!(await exists(localManifestPath))) {
        return true;
      }
      const localManifestData = await fs.readFile(localManifestPath)
      const localManifest = JSON.parse(localManifestData);
      let response = await fetch(`${URLS.GITHUB_RAWCONTENT}/${repo}/${branch}/manifest.json`);
      let manifest = await response.json();

      return localManifest.version != manifest.version;
    }
    catch (err) {
      continue;
    }
  }

  throw Error('Failed to read manifest.')
}



/** Return list of plugin repositories on GitHub. */
async function getPluginsRepos() {
  const spinner = ora("Fetching community-plugins.json").start();

  // Fetch community-plugins.json and turn it into object
  const communityPluginsJson = await fetch(URLS.COMMUNITY_PLUGINS).then(
    (response) => response.json()
  );

  // Get "repo" from every plugin.
  const pluginsRepos = communityPluginsJson.map((plugin) => plugin.repo);

  spinner.succeed(`Found ${pluginsRepos.length} plugins!`);

  // [author/pluginname, author2/pluginname3...]
  return pluginsRepos;
}

function run() {
  getPluginsRepos()
    .then((repos) => {
      return processRepositories(repos)
    })
    .then((status) => {
      if (!status.newRepos.length && !status.updatedRepos.length && !status.failedRepos.length) {
        console.log('Everything is up to date.');
        return;
      }

      const divider = '-----------';

      if (status.newRepos.length) {
        console.log(`\n${chalk.yellow(figures.star)}  ${status.newRepos.length} new`)
        console.log(divider);
        status.newRepos.forEach(x => {
          console.log(`   ${x.repo}`)
        })
      }

      if (status.updatedRepos.length) {
        console.log(`\n${chalk.blue(figures.tick)}  ${status.updatedRepos.length} updated`)
        console.log(divider);
        const insertionsLabel = chalk.green('+');
        const deletionsLabel = chalk.red('-');
        const changesLabel = chalk.blue(figures.tick);
        status.updatedRepos.forEach(x => {
          const { changes, deletions, insertions } = x.summary;
          console.log(`   ${x.repo} [${changes}${changesLabel}, ${insertions}${insertionsLabel}, ${deletions}${deletionsLabel}]`);
        })
      }

      if (status.failedRepos.length) {
        console.log(`\n${chalk.red(figures.warning)}  ${status.failedRepos.length} failed`)
        console.log(divider);
        status.failedRepos.forEach(x => {
          console.log(`   ${x.repo}: ${x.err.message}`)
        })
      }

    });
}

const vargs = yargs(process.argv.slice(2))
  .usage('Usage: $0 [options]')
  .option('jobs', {
    alias: 'j',
    describe: 'number of parallel jobs',
    default: 10,
    type: 'number'
  })
  .option('all-changes', {
    alias: 'a',
    describe: 'If true pull all changes; else changes are pulled only if plugin version changed',
    default: false,
    type: 'boolean'
  })
  .argv;

options.jobCount = vargs.jobs;
options.getOnlyNewVersion = vargs.onlyNewVersions;

run();
