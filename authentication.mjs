import express from "express";


let userAccess = false;

let userAccessGranted = (req, res, next) => {
    const password = req.body["password"];
    if (password === "joemrnice$") {
        userAccess = true;
    }
    next();
};

export default userAccessGranted;