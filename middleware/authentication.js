const {validateToken} = require("../service/authentication");

//if i dont return the function then i cant sen cookie name from index
function checkForAuthenticationCookie(cookieName){
    //return the function 
    return function(req,res,next){
        const TokenCookieValue = req.cookies[cookieName];
        //token cookie value dont exist
        if(!TokenCookieValue){
            return next();//then cll next middleware
        }

        try{
            const userPayload = validateToken(TokenCookieValue);
            //store user payload
            req.user = userPayload;
            //next();
        }catch(err){
            //next();
        }
        next();
    }
}

module.exports = {
    checkForAuthenticationCookie,
}