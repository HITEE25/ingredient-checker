const JWT = require("jsonwebtoken");
const secret = "hitEE#1725";

function creatTokenUser(user){
    const payload = {
        _id: user._id,
        fullname: user.fullname,
        email: user.email,
        password: user.password,
        imageUrl: user.imageUrl,
    }

    const token = JWT.sign(payload,secret);
    return token;
}

function validateToken(token){
    const payload = JWT.verify(token,secret);
    return payload;
}

module.exports = {
    creatTokenUser,
    validateToken,
}