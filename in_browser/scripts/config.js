/*
Copyright 2026 Sadra Mohtadi

Licensed under the Apache License, Version 2.0
http://www.apache.org/licenses/LICENSE-2.0
*/

// MAKE SURE TO UPDATE THE FOLLOWING FOR THE APP TO FUNCTION
const SERP_API = 'efc9469cda7d6d04864a3fa95c4bbbc4d7fd14cffce66b9896074d4c298ffa72';

function setCookie(cname, cvalue, exdays) {
    const d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    let expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
let name = cname + "="; 
let ca = document.cookie.split(';');
for(let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
    c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
    return c.substring(name.length, c.length);
    }
}
return "";
}
function capitalize(str) {
    return str
        .replace(/[_-]/g, " ")   // replace _ and - with space
        .replace(/\b\w/g, c => c.toUpperCase());
}
// The sourceMap is hard coded for THIS version but in the full version it'll be hosted on the server and updated constantly.
// Also, in the final version, the sourceMap will be different depending on the category of the item. Eg, if an antique item is searched, a webstie like eBay will be priotrized.
let sourceMap = Object.freeze({
    DEFAULT: {
        "Amazon.com": 1,
        "Food Basics": 0.8,
        "Staples": 0.8,
        "Walmart": 0.7,
        "Etsy": 0.6,
        "eBay": 0.1
    },
    MARKETPLACE: {
        "eBay": 1.0,
        "Facebook": 0.95,
        "Kijiji": 0.9,
        "Craigslist": 0.75,
        "Poshmark": 0.72,
        "Vinted": 0.70,
        "ThredUp": 0.65,
        "Decluttr": 0.62,
        "Etsy": 0.60,
        "Amazon": 0.55,
        "Shopify": 0.45,
        "Bonanza": 0.40,
        "Walmart": 0.2,
        "Temu": 0.05,
        "Wish": 0.05,
    }
});