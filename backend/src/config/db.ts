import mongoose from "mongoose";
import { config } from "./config";

const connectDB = async () => {
  await mongoose.connect(config.MONGO_URI)
    .then(() => {
      console.log("Connected to DB.");
    })
    .catch((err) => {
      console.error(err);
    });
};

export default connectDB;
