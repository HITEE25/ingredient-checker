# 🥗 IngrediChecker

IngrediChecker is a web-based ingredient analysis platform that helps users make healthier food choices. Users can upload an image of a food label or enter ingredients manually. The application extracts text using OCR (Optical Character Recognition), analyzes ingredients based on the user's health profile, and provides personalized health insights.

---

## ✨ Features

- 🔐 User Registration & Login
- 👤 Personalized Health Profile
- 📸 Upload Food Label Images
- 🔍 OCR-Based Ingredient Extraction
- 📝 Manual Ingredient Search
- 🩺 Personalized Ingredient Analysis
- ⚠️ Health Risk Detection
- 🥗 Nutrition Information
- ☁️ Cloudinary Image Storage
- 📱 Responsive User Interface

---

## 🛠️ Tech Stack

| Category | Technology |
| -------- | ---------- |
| **Language** | JavaScript |
| **Runtime** | Node.js |
| **Backend** | Express.js |
| **Database** | MongoDB |
| **ODM** | Mongoose |
| **Templates** | EJS |
| **Frontend** | HTML, CSS, Bootstrap, JavaScript |
| **Authentication** | JWT & Cookies |
| **OCR** | Tesseract.js, Node-Tesseract-OCR |
| **File Upload** | Multer |
| **Image Storage** | Cloudinary |
| **API Integration** | Axios |
| **Environment Variables** | Dotenv |
| **Version Control** | Git & GitHub |

---

## 🗄️ Database

| Collection | Purpose |
| ---------- | ------- |
| `users` | Stores user account information, login credentials, and profile details. |
| `healthprofiles` | Stores user-selected health conditions for personalized ingredient analysis. |
| `ingredients` | Stores ingredient analysis data (if applicable). |

---

## 🔐 Authentication

| Method | Endpoint | Description |
| ------- | -------- | ----------- |
| GET | `/user/signup` | User Registration Page |
| POST | `/user/signup` | Register New User |
| GET | `/user/signin` | Login Page |
| POST | `/user/signin` | Authenticate User |
| GET | `/user/logout` | Logout User |

---

## 🥗 Ingredient Analysis

| Method | Endpoint | Description |
| ------- | -------- | ----------- |
| GET | `/` | Home Page |
| GET | `/tools/home` | Home Page |
| GET | `/tools/inchecker` | Ingredient Checker Page |
| GET | `/tools/search` | Manual Ingredient Search |
| POST | `/tools/health` | Save User Health Profile |
| GET | `/tools/health` | View Health Profile |
| POST | `/tools/upload` | Upload Ingredient Label Image |
| POST | `/tools/analyze` | Analyze Ingredients |

---

## 📄 Information Pages

| Method | Endpoint | Description |
| ------- | -------- | ----------- |
| GET | `/tools/about` | About Page |
| GET | `/tools/contact` | Contact Page |
| GET | `/tools/support` | Support Page |

---

## 📂 Project Structure

```
ingredentcheker/
│
├── config/
├── controllers/
├── middleware/
├── models/
├── public/
│   ├── css/
│   ├── images/
│   ├── uploads/
│   └── js/
├── routes/
├── service/
├── views/
├── index.js
├── package.json
└── README.md
```

---

## 🚀 Installation

### Clone the Repository

```bash
git clone https://github.com/yourusername/ingredichecker.git

cd ingredichecker
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env` file in the project root.

```env
PORT=8000
MONGO_URL=your_mongodb_connection_string
JWT_SECRET=your_secret_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Start the Server

```bash
npm start
```

or for development:

```bash
npm run dev
```

Open your browser and visit:

```
http://localhost:8000
```

---

## 🔄 Application Workflow

```
User

↓

Register / Login

↓

Select Health Profile

↓

Upload Food Label
or
Enter Ingredients

↓

OCR Extracts Ingredients

↓

Ingredient Analysis

↓

Personalized Health Report

↓

Healthier Food Recommendations
```

---

## 🎯 Future Enhancements

- 🤖 AI-Based Ingredient Risk Analysis
- 📊 Product Health Score
- 📷 Barcode Scanner
- 🥫 OpenFoodFacts API Integration
- ❤️ Save Favorite Products
- 📈 Nutrition Dashboard
- 🌍 Multi-language Support
- 📱 Progressive Web App (PWA)
- 🌙 Dark Mode
- 📤 Export Health Reports

---

## 👨‍💻 Author

**Hitee Patel**

IT Engineering Student

GitHub: https://github.com/HITEE25

---

## 📄 License

This project is developed for educational and learning purposes.

---

⭐ If you found this project useful, consider giving it a **Star** on GitHub!
