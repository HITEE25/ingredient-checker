//Loads the Express library => Stores it in the variable express
//Express is a Node.js web framework that helps you: 
//Create a server
//Handle routes (/, /login, /user)
//Use middleware
//Send responses easily
const express = require('express');
//to use database
const mongoose = require("mongoose");
//Work with file paths safely
const path = require('path');
const app = express();

//cookie-parser is Express middleware that reads cookies from the HTTP request and makes them easy to use.
const cookieParser = require("cookie-parser");

const {checkForAuthenticationCookie} = require("./middleware/authentication");

//take user route
const userRoute = require("./routes/user");
//take tools route
const toolsRoute = require("./routes/tools");

mongoose.set("strictQuery", false);

mongoose
   .connect(process.env.MONGO_URI)
   .then((e) => {console.log("mogoDB connected")});

//view engine setup for usinf=g ejs
app.set("view engine","ejs");
app.set("views",path.resolve("./views"));
//images must be served via express.static
app.use(express.static("public"));

//handel form data
app.use(express.urlencoded({extended: false}));
//cookie parser
app.use(cookieParser());
//check for authentication cookie
app.use(checkForAuthenticationCookie("token"));
console.log(typeof checkForAuthenticationCookie);
//to pass user data to locals
app.use((req,res,next) => {
    res.locals.user = req.user;
    next();
})
console.log("userRoute type:", typeof userRoute);
console.log("toolsRoute type:", typeof toolsRoute);


app.use("/user",userRoute);
app.use("/tools",toolsRoute);

app.get('/',(req,res) => {
    res.render('home');
})

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log("server started on port number : 8000");
})
