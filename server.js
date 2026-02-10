const express = require("express");
const path = require("path");

const app = express();

// serve static build
app.use(express.static(path.join(__dirname, "build")));

// fallback for React Router
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log("listening on", port);
});
