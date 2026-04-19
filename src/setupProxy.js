const { createProxyMiddleware } = require('http-proxy-middleware');
module.exports = function (app) {
  app.use(
    '/wss',
    createProxyMiddleware({
      target: "https://wh-land-backend-goet3.ondigitalocean.app/",
      changeOrigin: true,
      ws: true,
      secure: true,
    })
  );
  app.use(
    '/api',
    createProxyMiddleware({
      target: "https://wh-land-backend-goet3.ondigitalocean.app/",
      changeOrigin: true,
      secure: true,
    })
  );
};
