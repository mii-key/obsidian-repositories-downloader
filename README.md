# Obsidian Repositories Downloader

Learn, analyze and inspire from every [obsidian.md](https://obsidian.md) plugin!

Explore and search in the source code of all officially published plugins:

![search](/doc/img/search.png)

It's especially useful as Obsidian API isn't yet documented and GitHub search doesn't work as expected.

# Features
## Download source code of all officially published Obsidian plugins
![run](/doc/img/run.gif)

## Fast updates
Repos are checked and downloaded in parallel. By default, to speed up updates, changes are downloaded only for plugins with changed version. 
You can configure number of parallel jobs or update scope via [options](#options).

## An update report
After each run see what was added or updated:
![update-report](/doc/img/update-report.png)

## Nice tree structure
![repo-structure](/doc/img/repo-structure.png)

# Installation
```bash
git clone https://github.com/mii-key/obsidian-repositories-downloader.git
cd obsidian-repositories-downloader
npm install
```

Get help:
```
npm start -- --help
```

# Run
```bash
npm start [-- [options]]
```
### Options

- `jobs|j` - number of parrallel jobs.
- `all|a` - get all changes. By default for existing plugins changes are downloaded only if plugin version is changed.

**Example**. Start 20 jobs and get all changes:
```bash
npm start -- -j 20 -a
```

# Other Tools
- Original [obsidian-repositories-downloader](https://github.com/konhi/obsidian-repositories-downloader)
- [Everything](https://www.voidtools.com/): advanced search
- [obsidian-plugin-downloader](https://github.com/luckman212/obsidian-plugin-downloader): similiar tool written in Shell

