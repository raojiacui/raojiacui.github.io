'use strict';

function makePostsCollection(posts) {
  return {
    data: posts,
    length: posts.length,
    each: function(iterator) {
      posts.forEach(iterator);
    }
  };
}

function postTime(post) {
  return post.date && post.date.valueOf ? post.date.valueOf() : 0;
}

function sortPosts(posts) {
  return posts.slice().sort(function(left, right) {
    return postTime(right) - postTime(left);
  });
}

function archivePage(path, posts, extras) {
  var data = extras || {};
  data.archive = true;
  data.posts = makePostsCollection(posts);
  data.total = 1;
  data.current = 1;
  data.base = path.replace(/index\.html$/, '');
  return {
    path: path,
    layout: ['archive', 'index'],
    data: data
  };
}

hexo.extend.generator.register('local_archive', function(locals) {
  var archiveDir = this.config.archive_dir || 'archives';
  var posts = sortPosts(locals.posts.toArray ? locals.posts.toArray() : locals.posts.data || []);
  var routes = [archivePage(archiveDir + '/index.html', posts, {})];
  var years = {};
  var months = {};

  posts.forEach(function(post) {
    if (!post.date) return;
    var year = String(post.date.year());
    var month = post.date.format('MM');
    var monthKey = year + '/' + month;

    if (!years[year]) years[year] = [];
    if (!months[monthKey]) months[monthKey] = [];
    years[year].push(post);
    months[monthKey].push(post);
  });

  Object.keys(years).forEach(function(year) {
    routes.push(archivePage(archiveDir + '/' + year + '/index.html', years[year], {
      year: year
    }));
  });

  Object.keys(months).forEach(function(monthKey) {
    var parts = monthKey.split('/');
    routes.push(archivePage(archiveDir + '/' + parts[0] + '/' + parts[1] + '/index.html', months[monthKey], {
      year: parts[0],
      month: parts[1]
    }));
  });

  return routes;
});