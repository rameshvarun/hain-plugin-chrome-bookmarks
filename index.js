'use strict';

const path = require('path');
const fs = require('fs');
const favicon = require('favicon');
const request = require('request');

const BOOKMARKS_PATH = path.join(process.env.LOCALAPPDATA, "Google", "Chrome",
  "User Data", "Default", "Bookmarks");
const DEFAULT_ICON = "#fa fa-bookmark-o"
const MAX_RESULTS = 20;

module.exports = (context) => {
  let bookmarks = []; // List of loaded bookmarks.
  let favicons = new Map(); // Cached Favicon urls found for the bookmarks.

  // This function recursively loads bookmarks from folders.
  function load(item) {
    if (item.type === "url") bookmarks.push(item);
    else if (item.type === "folder") item.children.forEach(load);
  }

  function startup() {
    context.logger.log("Opening Chrome Bookmarks file.");
    if(fs.existsSync(BOOKMARKS_PATH)) {
      try {
        const data = JSON.parse(fs.readFileSync(BOOKMARKS_PATH, "utf8"));

        // Load in bookmarks from all of the roots.
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
    query = query.trim();
    if (query.startsWith('/')) return; // Ignore commands.

    // Fuzzy-match the query.
    let results = context.matchutil.fuzzy(bookmarks, query, x => x.name)
        .filter(x => x.score >= 5) // Remove low-scoring items.
        .slice(0, MAX_RESULTS) // Limit results.
        .map(x => {
      return {
        id: x.elem.id,
        title: context.matchutil.makeStringBoldHtml(x.elem.name, x.matches),
        desc: x.elem.url,
        payload: x.elem.url,
        score: x.score,
        icon: favicons.get(x.elem.url)
      };
    });
    res.add(results);

    // Asynchronously try to load favicons.
    results.forEach(x => {
      if (!favicons.has(x.payload)) {
        favicon(x.payload, (err, favicon_url) => {
          if (err) {
            favicons.set(x.payload, DEFAULT_ICON);
            return;
          }

          // Check to see if the favicon url returns a 200 status.
          request(favicon_url, (error, response, body) => {
            if (error || response.statusCode != 200 ||
                response.headers["content-length"] == 0) {
              favicons.set(x.payload, DEFAULT_ICON);
              return;
            }

            // Update the result with the favicon.
            favicons.set(x.payload, favicon_url);
            res.remove(x.id);
            x.icon = favicon_url;
            res.add(x);
          });
        });
      }
    });
  }

  function execute(id, payload) {
    // Load url in browser.
    context.shell.openExternal(payload);
    context.app.close();
  }

  return { startup, search, execute };
};
