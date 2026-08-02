const jwt = require("jsonwebtoken");

const auth = (req,res,next)=>{

    try{

        const authHeader = req.headers.authorization;

        if(!authHeader){

            return res.status(401).json({

                message:"Access Denied. No Token Provided."

            });

        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(

            token,

            process.env.JWT_SECRET

        );

        req.user = decoded;

        next();

    }

    catch(error){

        res.status(401).json({

            message:"Invalid Token"

        });

    }

};

module.exports = auth;