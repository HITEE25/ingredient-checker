const { Router } = require("express");
const router = Router();
//to upload a photo
const multer = require("multer");
//api calls
const axios = require("axios");
//ocr image => convert image => plain text
const Tesseract = require("tesseract.js");
//Prevents disk from filling up, we are using fs
// fs = require("fs");
const healthProfile = require("../models/tools");
//const path = require("path");
//requires custom user agent
//help them to identify app
//prevents bot users
const USER_AGENT = "MyFoodApp/1.0 (hitee0025@gmail.com)";
const CALORIE_NINJAS_KEY = process.env.CALORIE_NINJAS_KEY;

//create a disk storage 

const cloudinary = require("../config/cloudinary");

const { CloudinaryStorage } = require("multer-storage-cloudinary");

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "ingredient-checker",
        allowed_formats: ["jpg", "png", "jpeg", "webp"]
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed"));
        }
    }
});

/*//__dirname store absolute path 
const uploadDir = path.join(__dirname, '../public/uploads');
//check if folder exist , dont exist create it 
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });//recursive: true create parent folder if not exist
}*/

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
        const userProfile = await healthProfile.findOne({ user: req.user._id });
        const healthcondition = userProfile?.healthConditions || [];
        //wait for response
        //Openfoodfact is and website from where api calls are made
        //sending clean ocr text
        const analysis = await analyzeWithCalorieNinjas(ingredenttext, healthcondition);
        analysis.healthConditions = healthcondition;

        //storing in DB , storing ingredients,
        //analytic genrated about ingredient
        let tool;
        try {
            //console.log("Calling Open Food Facts...");
            tool = await healthProfile.findOneAndUpdate(
                { user: req.user._id },  // Find existing
                {
                    productImage: req.file.path,
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
        /*fs.unlink(imagePath, (err) => {
            if (err) console.log("File delete error", err);
        });*/

        return res.render(page, {
            tool,
            analysis,
            healthcondition: healthcondition.join(", ") || "Not selected",
            error: null
        });

    }
    catch (error) {
        // Only delete if file exists
        /*if (imagePath && fs.existsSync(imagePath)) {
            fs.unlink(imagePath, (err) => {
                if (err) console.error("File delete error:", err);
            });
        }*/

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
        const userProfile = await healthProfile.findOne({ user: req.user._id });
        const healthcondition = userProfile?.healthConditions || [];

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
        const analysis = await analyzeWithCalorieNinjas(
            search.trim(),
            healthcondition
        );
        analysis.healthConditions = healthcondition;

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


async function analyzeWithCalorieNinjas(ingredients, healthConditions = []) {
    try {
        //encode ingredients for url safety
        //ingredients are passed in parameters
        const apiUrl = `https://api.calorieninjas.com/v1/nutrition?query=${encodeURIComponent(ingredients)}`;

        //console.log(USER_AGENT)
        const response = await axios.get(apiUrl, {
            headers: {//for authentication
                'X-Api-Key': CALORIE_NINJAS_KEY,
                'User-Agent': USER_AGENT
            },
            timeout: 10000
        });

        //console.log(response);
        //safely extract nutrition items array
        const items = response.data.items || [];
        console.log(items)

        // YOUR EXISTING SAFETY ANALYSIS (works perfectly)
        const harmful = detectHarmfull(ingredients, healthConditions);
        const safe = detectSafe(ingredients, healthConditions);

        // Nutrition summary from CalorieNinjas
        //Sums totals across all items
        const nutritionSummary = items.reduce((sum, item) => ({
            calories: (sum.calories || 0) + (item.calories || 0),
            sugar: (sum.sugar || 0) + (item.sugar_g || 0),
            sodium: (sum.sodium || 0) + (item.sodium_mg || 0),
            fat: (sum.fat || 0) + (item.fat_total_g || 0),
            itemsAnalyzed: items.length
        }), {});

        return {
            success: true,
            productName: `${items.length} ingredients analyzed`,
            ingredients: ingredients,
            nutrition: nutritionSummary,
            harmful,
            safe,
            totalHarmful: harmful.length,
            totalSafe: safe.length,
            source: "CalorieNinjas + Your Safety Rules"
        };

    } catch (error) {
        console.log("CalorieNinjas failed, using safety analysis only");
        // Fallback to your existing logic
        return {
            success: true,
            productName: "Safety Analysis (nutrition unavailable)",
            ingredients: ingredients,
            harmful: detectHarmfull(ingredients, healthConditions),
            safe: detectSafe(ingredients, healthConditions),
            nutrition: { error: "Nutrition lookup failed" }
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
