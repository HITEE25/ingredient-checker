const {Schema,model} = require("mongoose");
const {createHmac,randomBytes} = require("crypto");
const {creatTokenUser} = require("../service/authentication");


const userSchema = new Schema({
    fullname:{
        type: String,
        required: true,
    },
    email:{
        type: String,
        required: true,
        unique: true,
    },
    password:{
        type: String,
        required: true,
    },
    salt:{
        type: String,
    },
    imageUrl:{
        type: String,
        default: "/image/default.png",
    },
    role:{
        type: String,
        enum: ['USER','ADMIN'],
        default: "USER",
    }
},
{timestamps: true},
)

userSchema.pre("save",function(next){
    const user = this;

     //password field was modified before running expensive operations like hashing.
    if(!user.isModified("password")) return next();

    //create a salt
    const salt = randomBytes(16).toString("hex");
    //create hash password
    const hashPass = createHmac("sha256",salt)
      .update(user.password)
      .digest("hex");
    //update password and salt
    this.salt = salt;
    this.password = hashPass;

    next();
})

userSchema.statics.matchPasswordAndToken = async function(email,password){
    //find user with email
    const user = await this.findOne({email});
    //if user not found
    if(!user) throw new Error("user not found");

    const salt = user.salt;
    //it would take hased password
    const hashPass = user.password;

    const userProvidedHashPass = createHmac("sha256",salt)
       .update(password)
       .digest("hex");
    
    if(userProvidedHashPass !== hashPass){
        throw new Error("Incorrect Password");
    }

    const token = creatTokenUser(user);
    return token;
}
//create model
const User = model("user",userSchema);

module.exports = User;