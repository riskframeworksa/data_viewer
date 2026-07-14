import { createApp } from "./js/main.js?v=11";

createApp().catch((error) => {
  console.error(error);
  const status = document.getElementById("mapStatus");
  if (status) {
    status.textContent = `Failed to initialize the atlas: ${error.message}`;
  }
});
