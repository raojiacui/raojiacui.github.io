if (require.main === module) {
  const Hexo = require('hexo');
  const path = require('path');

  const blog = new Hexo(path.resolve(__dirname, '..'), {
    config: path.resolve(__dirname, '..', '_config.yml')
  });

  blog.init().then(() => {
    console.log('Config loaded, source_dir:', blog.config.source_dir);
    return blog.load();
  }).then(() => {
    const posts = blog.locals.get('posts');
    console.log('Posts found:', posts.length);
    return blog.call('generate', {});
  }).then(() => {
    console.log('Generate done!');
    process.exit(0);
  }).catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}
