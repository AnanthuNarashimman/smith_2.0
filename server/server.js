const { createApp } = require("./app");

const PORT = process.env.AGENT_SMITH_PORT || 6789;

createApp().listen(PORT, () => {
  console.log(`Agent Smith server listening on http://localhost:${PORT}`);
});
