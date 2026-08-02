require("dotenv").config();

const app = require("./app");

const connectDatabase = require("./config/database");

const redisClient = require("./config/redis");

const PORT = process.env.PORT || 5000;

async function startServer(){

    try{

        await connectDatabase();

        await redisClient.connect();

        console.log("Redis Connected");

        app.listen(PORT,()=>{

            console.log(`Server running on port ${PORT}`);

        });

    }

    catch(error){

        console.error(error);

        process.exit(1);

    }

}

startServer();