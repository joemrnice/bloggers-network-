import express from "express";


let userAccess = false;

let userAccessGranted = (req, res, next) => {
    const password = req.body["password"];
    //modify password in the condition statement to authenticate yourself
    if (password === "joemrnice$") {
        userAccess = true;
    }
    next();
};

export default userAccessGranted;