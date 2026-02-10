const { createProxyMiddleware } = require('http-proxy-middleware');
module.exports = function (app) {
  app.use(
    '/wss',
    createProxyMiddleware({
      target: 'https://chat-backend-7isxn.ondigitalocean.app',
      changeOrigin: true,
      ws: true,
      secure: true,
    })
  );
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://chat-backend-7isxn.ondigitalocean.app',
      changeOrigin: true,
      secure: true,
    })
  );
};
