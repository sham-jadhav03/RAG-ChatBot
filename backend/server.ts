import app from "./src/app.js";
import { config } from "./src/config/config.js";
import connectDB from "./src/config/db.js";
import "./src/redis/subscriber.js"

connectDB();

const PORT = config.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server is running on port 4000`);
});
