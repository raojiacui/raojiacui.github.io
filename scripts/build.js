const Hexo = require('hexo');
const path = require('path');

const hexo = new Hexo(path.resolve(__dirname, '..'), {
  config: path.resolve(__dirname, '..', '_config.yml')
});

hexo.init().then(() => {
  console.log('Config loaded, source_dir:', hexo.config.source_dir);
  return hexo.load();
}).then(() => {
  const posts = hexo.locals.get('posts');
  console.log('Posts found:', posts.length);
  return hexo.call('generate', {});
}).then(() => {
  console.log('Generate done!');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
