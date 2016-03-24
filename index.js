'use strict';

const path = require('path');
const fs = require('fs');

const BOOKMARKS_PATH = path.join(process.env.LOCALAPPDATA, "Google", "Chrome",
  "User Data", "Default", "Bookmarks");

module.exports = (context) => {
  let bookmarks = [];

  function load(item) {
    if (item.type === "url") bookmarks.push(item);
    else if (item.type === "folder") item.children.forEach(load);
  }

  function startup() {
    context.logger.log("Opening Chrome Bookmarks file.");
    if(fs.existsSync(BOOKMARKS_PATH)) {
      try {
        const data = JSON.parse(fs.readFileSync(BOOKMARKS_PATH, "utf8"));
        for(var root in data.roots) {
          if(typeof data.roots[root] === "object")
            load(data.roots[root]);
        }
      } catch (e) {
        context.toast.enqueue("Chrome Bookmarks file found, but it could not be opened.");
      }
    } else {
      context.toast.enqueue("Chrome Bookmarks file not found.");
    }
  }

  function search(query, res) {
    let results = context.matchutil.fuzzy(bookmarks, query, x => x.name)
        .filter(x => x.score >= 5)
        .map(x => {
      const m = context.matchutil.makeStringBoldHtml(x.elem.name, x.matches);
      return {
        id: x.elem.id,
        title: m,
        desc: x.elem.url,
        payload: x.elem.url,
        score: x.score
      };
    });
    res.add(results);
  }

  function execute(id, payload) {
    context.shell.openExternal(payload);
    context.app.close();
  }

  return { startup, search, execute };
};
