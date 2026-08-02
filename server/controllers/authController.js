const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const register = async(req,res)=>{

    try{

        const{

            name,

            email,

            password

        }=req.body;

        if(

            !name ||

            !email ||

            !password

        ){

            return res.status(400).json({

                message:"All fields are required"

            });

        }

        const existingUser = await User.findOne({

            email

        });

        if(existingUser){

            return res.status(409).json({

                message:"Email already exists"

            });

        }

        const hashedPassword = await bcrypt.hash(

            password,

            10

        );

        const user = await User.create({

            name,

            email,

            password:hashedPassword

        });

        res.status(201).json({

            success:true,

            message:"User Registered",

            user:{

                id:user._id,

                name:user.name,

                email:user.email

            }

        });

    }

    catch(error){

        res.status(500).json({

            message:error.message

        });

    }

};
const login = async(req,res)=>{

    try{

        const{

            email,

            password

        }=req.body;

        if(

            !email ||

            !password

        ){

            return res.status(400).json({

                message:"Email and Password are required"

            });

        }

        const user = await User.findOne({

            email

        });

        if(!user){

            return res.status(401).json({

                message:"Invalid Email or Password"

            });

        }

        const isMatch = await bcrypt.compare(

            password,

            user.password

        );

        if(!isMatch){

            return res.status(401).json({

                message:"Invalid Email or Password"

            });

        }

        const token = jwt.sign(

            {

                id:user._id,

                email:user.email,

                role:user.role

            },

            process.env.JWT_SECRET,

            {

                expiresIn:"7d"

            }

        );

        res.status(200).json({

            success:true,

            message:"Login Successful",

            token,

            user:{

                id:user._id,

                name:user.name,

                email:user.email,

                role:user.role

            }

        });

    }

    catch(error){

        res.status(500).json({

            message:error.message

        });

    }

};
const profile = async(req,res)=>{

    res.status(200).json({

        success:true,

        user:req.user

    });

};
module.exports={

    register,

    login,

    profile

};