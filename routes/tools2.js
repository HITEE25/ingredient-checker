const { Router } = require("express");
const router = Router();
//to upload a photo
const multer = require("multer");
//api calls
const axios = require("axios");
//ocr image => convert image => plain text
const Tesseract = require("tesseract.js");
//Prevents disk from filling up, we are using fs
const fs = require("fs");
const healthProfile = require("../models/tools");
const path = require("path");
//requires custom user agent
//help them to identify app
//prevents bot users
const USER_AGENT = "IngredientAnalyzer/1.0 (hitee0025@gmail.com)"

//create a disk storage 
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        //reslove the path of folder
        cb(null, "./public/uploads");
    },
    filename: function (req, file, cb) {
        //create name of file
        const filename = `${Date.now()}-${file.originalname}`;
        cb(null, filename);
    }
})

//Multer upload middleware
const upload = multer({
    storage,
    limits: {//to give size limits
        fileSize: 10 * 1024 * 1024,//10mb
    },//to check if image is uploaded 
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        }
        else {
            cb(new Error("only image files are allowed"));
        }
    }
});

//__dirname store absolute path 
const uploadDir = path.join(__dirname, '../public/uploads');
//check if folder exist , dont exist create it 
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });//recursive: true create parent folder if not exist
}

router.get("/", (req, res) => {
    res.render("home", {
        analysis: null,
        tool: null,
        healthcondition: [],
        error: null
    });
});

router.get("/home", (req, res) => {
    res.render("home", {
        analysis: null,
        tool: null,
        healthcondition: [],
        error: null
    });
});


router.get("/inchecker", (req, res) => {
    return res.render("inchecker");
})

router.get("/search", (req, res) => {
    return res.render("search", {
        analysis: null,
        inputText: "",
        error: null
    });
});

router.get("/support", (req, res) => {
    return res.render("support");
})


router.get("/contact", (req, res) => {
    return res.render("contact");
})

router.get("/about", (req, res) => {
    return res.render("about");
})

router.post("/health", async (req, res) => {
    try {
        //get health condition from frontend
        const healthcondition = req.body.healthConditions || [];

        //if user dont exist, not logged in
        if (!req.user || !req.user._id) {
            return res.redirect("/user/signin");//then redirct to signin page
        }

        //update the database
        await healthProfile.findOneAndUpdate(
            { user: req.user._id },
            { healthConditions: healthcondition },
            { upsert: true, new: true }
        )

        //also store in req.user for current session
        req.user.healthConditions = healthcondition;
        //tells the browser to go to another URL
        return res.redirect("/tools/health?updated=true");
    } catch (error) {
        //When you want to display results immediately
        return res.send("Error saving health profile");
    }
})

router.get("/health", (req, res) => {
    const healthConditions = [
        // Metabolic & Hormonal
        "DIABETES", "THYROID", "PCOS", "OBESITY", "METABOLIC_SYNDROME",

        // Cardiac & Blood
        "BP", "HEART_DISEASE", "HIGH_CHOLESTEROL", "STROKE_RISK", "ANEMIA",

        // Respiratory
        "ASTHMA", "BRONCHITIS", "RESPIRATORY_ALLERGY",

        // Organ Health
        "KIDNEY_DISEASE", "LIVER_DISEASE", "FATTY_LIVER",

        // Mental & Neurological
        "MIGRAINE", "ADHD", "ANXIETY", "INSOMNIA",

        // Food & Allergy
        "ALLERGY", "LACTOSE_INTOLERANCE", "GLUTEN_INTOLERANCE", "FOOD_SENSITIVITY",

        // Special Conditions
        "PREGNANCY", "CHILD", "ELDERLY"
    ];

    const updated = req.query.updated;

    res.render("health", {
        healthConditions,
        updated,
    });
})

async function uploadPhotoAndAnalyzeProduct(req, res, page) {
    if (!req.file) {
        return res.status(400).send("Please upload product photo");
    }

    //This is the full path of the saved image file
    //req => Represents the incoming HTTP request from the browser
    //add file to req.file

    if (!req.user || !req.user._id) {
        return res.render(page, {
            analysis: null,
            error: "Please login before uploading product."
        });
    }
    const imagePath = req.file.path;
    //req.file contains image
    //image path is proceesing until
    //console.log(`Processing image : ${imagePath}`);

    /*//show proccesing title 
    res.render("home", {
        processing: true,
        message: "Extracting ingredents from image....Please wait",
        result: null,
    })*/

    try {
        //console.log("Starting OCR...");
        //Tesseract will recognize imagePath , in english and print in console
        const result = await Tesseract.recognize(
            imagePath,
            'eng', {
            logger: m => {
                //console.log("OCR Progress:", m.status, m.progress);
            }
        }).catch(ocrError => {
            //console.error("Tesseract failed:", ocrError);
            throw new Error(`OCR failed: ${ocrError.message}`);
        });

        const text = result?.data?.text || "";

        if (!text.trim()) {//no text detected
            throw new Error("No text detected in image");
        }

        //clean extracted text
        const ingredenttext = cleanText(text);
        //console.log("OCR TEXT ===>", ingredenttext);
        //print extracted ingredents in console
        //console.log("Extracted ingredents", ingredenttext);

        //it would check if ingrednts was extracted
        if (!ingredenttext) {
            return res.render(page, {
                error: "No ingredents extracted from image. Please upload cleaner Image.",
                ocrText: text,
                result: null
            })
        }

        //get health condition from db
        //check if any health problem, if user is login
        //if no health problem store empty array
        const healthcondition = req.user?.healthConditions || [];
        //wait for response
        //Openfoodfact is and website from where api calls are made
        //sending clean ocr text
        const analysis = await analyzeIngredentsWithOpenfoodfact(ingredenttext, healthcondition);


        //storing in DB , storing ingredients,
        //analytic genrated about ingredient
        let tool;
        try {
            //console.log("Calling Open Food Facts...");
            tool = await healthProfile.findOneAndUpdate(
                { user: req.user._id },  // Find existing
                {
                    productImage: `/public/uploads/${req.file.filename}`,
                    ingredients: ingredenttext,
                    analysis,
                },
                {
                    upsert: true,  // Create if doesn't exist
                    new: true      // Return updated/new document
                }
            );
            //console.log("Tool saved/updated:", tool._id);
            //createdBy: req.user._id,
        } catch (dbError) {
            console.error("DB Save failed:", dbError);
            throw new Error(`Database error: ${dbError.message}`);
        };


        //passing analatic to frontend
        fs.unlink(imagePath, (err) => {
            if (err) console.log("File delete error", err);
        });

        return res.render(page, {
            tool,
            analysis,
            healthcondition: healthcondition.join(", ") || "Not selected",
            error: null
        });

    }
    catch (error) {
        // Only delete if file exists
        if (imagePath && fs.existsSync(imagePath)) {
            fs.unlink(imagePath, (err) => {
                if (err) console.error("File delete error:", err);
            });
        }

        return res.render(page, {
            analysis: null,
            tool: null,
            healthcondition: [],
            error: `Analysis failed: ${error.message}`  // Show specific error
        });
    }
}


//create a route to ingredient checker
router.post("/inchecker", upload.single("image"), async (req, res) => {
    //if file dont exists
    await uploadPhotoAndAnalyzeProduct(req, res, "inchecker");
})

router.post("/home", upload.single("image"), async (req, res) => {
    //if file dont exists
    await uploadPhotoAndAnalyzeProduct(req, res, "home");
})

//creating post router for search
//create a route to search ingredients
//using async function as function contains api calls
//using post request because user is submitting the form
router.post("/search", async (req, res) => {
    try {
        //if user don't login then force login
        if (!req.user || !req.user._id) {
            return res.render("search", {
                error: "Please Login Before Searching Ingredients",
                analysis: null,
                inputText: ""
            });
        }
        //getting text from frontend
        //fecthing information from form
        const { search } = req.body;
        //getting healthcondition from frontend
        const healthcondition = req.user?.healthConditions || [];

        //check if no search text written
        if (!search || !search.trim()) {
            //then print no text entered
            return res.render("search", {
                error: "Please enter ingredients to analyze",
                analysis: null,
                inputText: ""
            });
        }

        //get analysis from open food fact api
        const analysis = await analyzeIngredentsWithOpenfoodfact(
            search.trim(),
            healthcondition
        );

        //if anaylsis found then get anaylsis
        return res.render("search", {
            analysis: analysis,
            inputText: search,
            //it would join all healthcondition with ,
            healthcondition: healthcondition.join(", ") || "Not selected",
            error: null
        });
    } catch (error) {
        //if error occurs
        return res.render("search", {
            error: "Analysis failed. Please try again....",
            analysis: null,
            inputText: ""
        })
    }
})

function cleanText(text) {
    return text
        //covert to lower case
        .toLowerCase()
        //replace special char
        //char set [ ]
        //replace not char set ^
        //letters and number \w
        //space \s
        //, . - comma ,dot ,hypen
        //global g
        .replace(/[^\w\s,.\-]/g, '')
        //replace extra space
        .replace(/\s+/g, ' ')
        //remove space from left and right
        .trim()
        //split by , ; or newline
        .split(/[,;\n]/)
        //Removes extra spaces inside each item.
        .map(item => item.trim())
        //remove unsual char - , s
        .filter(item => item.length > 2)
        //first 20 ingredients
        .slice(0, 20)
        //now covert array to string
        .join(', ');// joining with ,
}

async function analyzeIngredentsWithOpenfoodfact(ingredent, healthcondition) {
    // Try 3 endpoints with retry
    const searchTerm = encodeURIComponent(ingredent.substring(0,50));

    const endpoints = [
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${searchTerm}&search_simple=1&json=1&page_size=10`,
        `https://world.openfoodfacts.org/api/v2/search?q=${searchTerm}&fields=product_name,ingredients_text,ingredients_text_en,nutrition_grades,nova_groups,additives_tags,additives_n,allergens_tags&page_size=10`, 
        `https://us.openfoodfacts.org/cgi/search.pl?search_terms=${searchTerm}&search_simple=1&json=1&page_size=10`
    ];
    for (let i = 0; i < endpoints.length; i++) {
        try {

            //use api url to get response from server
            //it is using version one url
            //which supports text search
            //const searchUrl = endpoints[i];

            //it would covert js object to query
            //it would store info related to , search ingredents , search type
            /*const searchParams = new URLSearchParams({
                //it would store first 100 ingredents
                //because large search space would slow down the website
                search_terms: ingredent.substring(0, 100),
                //it would use simple search
                search_simple: 1,
                json: 1,//return response in json format
                page_size: 1,//small output , one page result , best matcing product
                sort_by: "popularity",
                fields: 'product_name,ingredients_text,ingredients_text_en,nutrition_grades,nova_groups,additives_tags,additives_n,allergens_tags'  // Specific fields
            })*/

            //it would store response from  the server
            //axios send get request to server
            const { data } = await axios.get(endpoints[i], {  //  Use endpoint DIRECTLY
                headers: { 'user-agent': USER_AGENT },
                timeout: 30000,
                validateStatus: function (status) {
                    return status < 500;
                }
            }).catch(apiError => {
                console.error("OpenFoodFacts API failed:", apiError.message);
                throw new Error("Nutrition API timeout - using local analysis");
            });

            console.log("API response: ", data);

            //if data product length > 0
            //searchResponse.product it stores the array of product from api
            //length > 0 check if atlest one product exists
            //? => check if product is null, and prevent error if null
            if (data.products && data.products.length > 0) {

                //take out first response from array
                //as there would be multiple matches , choose the best match
                const product = data.products[0];

                //get ingredents text
                //find ingredients from ingredient_text,
                //if not found then find from ingredient_text_en
                //or used user typed ingredients => ingredent
                let Ingredienttext =
                    product.ingredients_text_en ||
                    product.ingredients_text ||
                    ingredent;

                // fallback to OCR ingredients
                if (!Ingredienttext || !Ingredienttext.trim()) {

                    console.log("Using OCR ingredients fallback");

                    Ingredienttext = ingredent;
                }

                //use open food fact field ,apply health condition
                const harmful = detectHarmfull(Ingredienttext, healthcondition);
                const safe = detectSafe(Ingredienttext, healthcondition);
                return {
                    ingredent: Ingredienttext,
                    //use product name if available
                    //if not available Product matched
                    productName: product.product_name || "Product matched",
                    //add product nutrition if not available print N/A
                    suggestions: [
                        `Nutrition grades: ${product.nutrition_grades || 'N/A'}`,
                        `Nova Processing level: ${product.nova_groups || 'Unknown'} `,//1 → unprocessed 4 → ultra-processed 
                        `Additives count: ${product.additives_n || '0'}`//total additive count
                    ].filter(Boolean),
                    //filter(Boolean), remove undefined value
                    harmful,
                    safe,
                    //Used to detect harmful food chemicals
                    additives: product.additives_tags || [],
                    //crtical for allergens based filering
                    allergens: product.allergens_tags || [],
                }
            }
        } catch (error) {
            console.log(`Endpoint ${i + 1} failed, trying next...`);
            if (i === endpoints.length - 1) {  // Last attempt
                break;
            }
        }
    }
    return {

        productName: "No matching product found",

        ingredent: ingredent,

        harmful:
            detectHarmfull(ingredent, healthcondition),

        safe:
            detectSafe(ingredent, healthcondition),

        suggestions: [
            "No OpenFoodFacts product matched. Using OCR ingredient analysis."
        ]
    };
}

async function analyzeIngredentsWithFatSecret(ingredent, healthcondition) {
    try {
        //used for authentication
        const crypto = require('crypto');
        
        //Clean text
        //trim() => remove space
        //split(',')[0] => take first ingreident
        const rawQuery = (ingredent.trim().split(',')[0] || 'apple').toLowerCase().trim();
        const searchQuery = encodeURIComponent(rawQuery); // covert text in url-safe format
        
        //current time in seconds for OAuth
        const timestamp = Math.floor(Date.now() / 1000).toString();
        //32 random bytes => convert base64 => remove spcial char => limit 32 char
        const nonce = crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
        
        //taken from documentation => correct order
        const params = {
            oauth_consumer_key: FATSECRET_KEY,
            oauth_nonce: nonce,
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: timestamp,
            oauth_version: '1.0',
            //foods.search is a method (API function) in the FatSecret API. It is used to search for food items in FatSecret’s database.
            method: 'foods.search',
            search_expression: searchQuery,
            max_results: '1',
            format: 'json'
        };
        
        //to map key with values => format=json& and join all parameters with &
        // Signature base string (MUST match query string EXACTLY)
        const sortedParams = Object.keys(params)
            .sort()  // Alphabetical order
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
            .join('&');
            
        const baseUrl = 'https://platform.fatsecret.com/rest/server.api';
        //in url add all parmaters
        //METHOD & URL & PARAMETERS
        const baseString = `GET&${encodeURIComponent(baseUrl)}&${encodeURIComponent(sortedParams)}`;
        
        //to create signature => first create secret key
        const signingKey = FATSECRET_SECRET + '&';
        //using secret key we will create signature
        const signature = crypto
            .createHmac('sha1', signingKey)
            .update(baseString)
            .digest('base64')
            .replace(/\+/g, '%2B')  // replace +
            .replace(/=/g, '%3D');  // replace =
            
        //Add signature to params
        params.oauth_signature = signature;
        
        // create Authorization header
        const oauthParams = Object.entries(params)
            .filter(([k]) => k.startsWith('oauth_'))//take parameters start with oauth
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}="${v}"`)
            .join(', ');
        //oauth_consumer_key="...", oauth_nonce="..."

        //Builds HTTP headers
        const headers = {
            Authorization: `OAuth ${oauthParams}`,
            'User-Agent': USER_AGENT
        };
        
        /*console.log(' DEBUG:', { rawQuery, timestamp, nonce: nonce.slice(0,8) + '...' });
        console.log('Base String Preview:', baseString.slice(0, 100) + '...');
        console.log('Signature:', signature);*/

        //SINGLE REQUEST - ALL params in query string
        //Sends GET request
        const response = await axios.get(baseUrl, {
            params,  // ALL params match signature exactly
            headers,
            timeout: 10000,
            family: 4 
        });

        console.log("API SUCCESS!");

        const data = response.data;
        console.log(data)
        //gets first result
        const food = data?.foods_search?.results?.food?.[0];
        console.log(food)
        if (food) {
            const serving = food.servings?.serving?.[0] || {};
            console.log(serving);
            return {
                success: true,
                productName: `${food.brand_name || ''} ${food.food_name}`.trim(),
                ingredient: ingredent,
                nutrition: {
                    calories: serving.calories || 'N/A',
                    carbs: serving.carbohydrate || 'N/A',
                    protein: serving.protein || 'N/A',
                    fat: serving.fat || 'N/A',
                    serving: serving.serving_description || 'N/A'
                },
                harmful: detectHarmfull(ingredent, healthcondition),
                safe: detectSafe(ingredent, healthcondition)
            };
        }

        return {//if no match product found
            success: true,
            productName: `No exact match for "${rawQuery}"`,
            ingredient: ingredent,
            harmful: detectHarmfull(ingredent, healthcondition),
            safe: detectSafe(ingredent, healthcondition)
        };

    } catch (error) {
        console.error(" ERROR:", error.response?.data || error.message);
        return {
            success: false,
            productName: "Analysis unavailable",
            ingredient: ingredent,
            harmful: detectHarmfull(ingredent, healthcondition),
            safe: detectSafe(ingredent, healthcondition),
            error: error.response?.data?.error?.message || 'Network error'
        };
    }
}


function detectHarmfull(ingredent, healthcondition = []) {
    //it would store condition rules based on health condition
    const conditionRules = {};

    //if any of health condition is true it would store pattern, risk in condition rules
    if (healthcondition.some(c => ['DIABETES', 'PCOS', 'OBESITY', 'METABOLIC_SYNDROME'].includes(c))) {
        conditionRules.sugars = {
            patterns: [/sugar/i, /glucose/i, /fructose/i, /syrup/i, /maltose/i],
            risk: 'High sugar Diabetes/PCOS risk',
        };
    }

    //if one of the health condition is true then it store in conditionRules
    if (healthcondition.some(c => ['BP', 'HEART_DISEASE'].includes(c))) {
        conditionRules.sodiumFat = {
            patterns: [/sodium/i, /salt/i, /trans fat/i, /palm oil/i],
            risk: 'High sodium/unhealthy fats',
        }
    }

    //if health condition is thyroid it would store in consition rules
    if (healthcondition.includes('THYROID')) {
        conditionRules.goitrogens = {
            patterns: [/soy/i, /cruciferous/i, /broccoli/i, /cabbage/i],
            risk: 'Goitrogens affecting thyroid function',
        }
    }

    if (healthcondition.includes('LACTOSE_INTOLERANCE')) {
        conditionRules.dairy = {
            patterns: [/milk/i, /lactose/i, /whey/i],
            risk: 'Dairy intolerance',
        }
    }

    if (healthcondition.includes('GLUTEN_INTOLERANCE')) {
        conditionRules.gluten = {
            patterns: [/gluten/i, /wheat/i],
            risk: 'Gluten source',
        }
    }

    if (healthcondition.includes('ALLERGY')) {
        conditionRules.allergens = { patterns: [/nuts/i, /peanut/i], risk: 'Common allergen' };
    }

    //Without personalization it would store common general harmful ingredients
    const generalHarmful = [
        { patterns: [/corn syrup/i], risk: 'Added sugar' },
        { patterns: [/high fructose/i], risk: 'High sugar' },
        { patterns: [/fructose|dextrose/i], risk: 'Added sugar' },
        { patterns: [/palm( oil)?/i], risk: 'Unhealthy fat' },
        { patterns: [/sodium|salt/i], risk: 'High sodium' },
        { patterns: [/msg|monosodium/i], risk: 'MSG allergen' },
        { patterns: [/aspartame/i], risk: 'Artificial sweetener' },
        { patterns: [/polydextrose/i], risk: 'Artificial fiber' },
        { patterns: [/modified.*starch/i], risk: 'Processed starch' }
    ];
    //Object.values(conditionRules) it would store value and not the key
    /*
    Object.values(conditionRules) returns
    [
      { patterns: [...], risk: "High sugar risk" },
      { patterns: [...], risk: "Dairy intolerance" }
    ]
    rule becomes ONE object at a time, like:
    rule = {
      patterns: [/sugar/i, /glucose/i],
      risk: "High sugar risk"
    };
     rule.patterns exists
     rules.patterns does NOT exist
    */
    const harmfull = [];
    Object.values(conditionRules).forEach(rule => {
        rule.patterns.forEach(pattern => {
            //it would test that ingredent contain pattern
            if (pattern.test(ingredent)) {
                //exec would searches string using regular expression and return matched text
                //result[0] contain actual matched string
                //other indices contain metadata
                const match = pattern.exec(ingredent)[0].toUpperCase();
                harmfull.push({ name: match, risk: rule.risk });
            }
        })
    })

    //general harmful
    generalHarmful.forEach(rule => {
        //rule constain pattern for each pattern it would check ingredients contain pattern
        rule.patterns.forEach(pattern => {
            if (pattern.test(ingredent)) {
                //exec searches string using regular expression and return matched string
                const match = pattern.exec(ingredent)[0].toUpperCase();
                harmfull.push({ name: match, risk: rule.risk });
            }
        })
    })
    //return in form of json
    //.new Set removes duplicate objects from the harmful array.
    //map(JSON.parse) Converts strings → objects
    // REMOVE DUPLICATES BASED ON ingredient name
    return Array.from(
        new Map(harmfull.map(item => [item.name, item])).values()
    );
}

function detectSafe(ingredent, healthcondition) {
    const safePatterns = [
        { pattern: /organic/i, reason: 'Organic' },
        { pattern: /natural/i, reason: 'Natural' },
        { pattern: /stevia/i, reason: 'Diabetes-friendly sweetener' }
    ]

    if (healthcondition.some(c => ['BP', 'HEART_DISEASE'].includes(c))) {
        safePatterns.push({
            pattern: /low sodium/i,
            reason: 'BP-friendly',
        })
    }

    const safe = [];
    safePatterns.forEach(rule => {
        if (rule.pattern.test(ingredent)) {
            const match = rule.pattern.exec(ingredent)[0].toUpperCase();
            safe.push({
                pattern: match,
                reason: rule.reason,
            })
        }
    })
    return safe;
}


module.exports = router;