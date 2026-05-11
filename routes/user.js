const {Router} = require("express");
const router = Router();

//to get user model
const User = require("../models/user");

router.get("/signin",(req,res) => {
    //return is NOT required here, but it is used to stop further execution of the function
    return res.render("signin");
});

router.get("/signup",(req,res) => {
    return res.render("signup");
});

router.post("/signin", async (req,res) => {
    const {email,password} = req.body;
    try{
       //create a token
       const token = await User.matchPasswordAndToken(email,password);
       //name of the cookie is token
       return res.cookie("token",token).redirect("/");
    }
    catch(err){
            return res.render("signin", {
                err:"Incorrect password or email",
            })
        }
    })

router.post("/signup",async (req,res) => {
    //create user if valid user
    const {fullname,email,password} = req.body;
    try{
        await User.create({
            fullname,
            email,
            password,
        });
        return res.redirect("/");
    }
    catch(err){
        console.log(err);
        if(err.code == 11000 && err.keyPattern && err.keyPattern.email){
            return res.render("signup",{
                err:"This email is already registered.Please use another email or sign in",
            })
        }
    }
})

//to delete the token
router.get("/logout",(req,res) => {
    res.clearCookie("token").redirect("/");
})


module.exports = router;
