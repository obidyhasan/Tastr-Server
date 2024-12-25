const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5174",
      "http://localhost:5173",
      "https://tastr-client.web.app",
      "https://tastr-client.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Create Custom Middleware
const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }

  jwt.verify(token, process.env.ACCESS_KEY, (err, decode) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized Access" });
    }

    req.user = decode;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0m3jt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();
    const foodCollection = client.db("tastrDB").collection("foods");
    const orderFoodCollection = client.db("tastrDB").collection("orders");

    // Create JWT Token
    app.post("/api/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_KEY, {
        expiresIn: "30d",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // Remove JWT Token
    app.post("/api/jwt/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ logoutSuccess: true });
    });

    // GET All Food Collection (Public)
    app.get("/api/foods", async (req, res) => {
      const { search } = req.query;

      const page = parseInt(req?.query?.page);
      const size = parseInt(req?.query?.size);

      let query = {};
      if (search) {
        query = { name: { $regex: search, $options: "i" } };
      }

      const result = await foodCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    // Foods Count
    app.get("/api/foodsCount", async (req, res) => {
      const count = await foodCollection.estimatedDocumentCount();
      res.send({ count });
    });

    // GET Food by Category (Public)
    app.post("/api/foods/category", async (req, res) => {
      const data = req.body;
      console.log(data);
      const query = { category: data.category };
      const result = await foodCollection.find(query).toArray();
      res.send(result);
    });

    // GET Top Foods (Public)
    app.get("/api/top-foods", async (req, res) => {
      const options = {
        sort: { purchaseCount: -1 },
      };

      const result = await foodCollection.find({}, options).limit(6).toArray();
      res.send(result);
    });

    // GET Food By USER Email (Private)
    app.get("/api/my-foods", verifyToken, async (req, res) => {
      const { email } = req.query;
      if (req.user.email !== email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const query = { addByEmail: email };
      const result = await foodCollection.find(query).toArray();
      res.send(result);
    });

    // GET Food By Id (Public)
    app.get("/api/foods/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await foodCollection.findOne(query);
      res.send(result);
    });

    // Add Food (Private)
    app.post("/api/foods", verifyToken, async (req, res) => {
      const { email } = req.query;
      if (req.user.email !== email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const food = req.body;
      const result = await foodCollection.insertOne(food);
      res.send(result);
    });

    // Update Food By Id (Private)
    app.patch("/api/foods/:id", verifyToken, async (req, res) => {
      const { email } = req.query;
      if (req.user.email !== email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const id = req.params.id;
      const food = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: food.name,
          category: food.category,
          image: food.image,
          description: food.description,
          origin: food.origin,
          price: food.price,
          quantity: food.quantity,
        },
      };
      const result = await foodCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Order Collection
    // Get Order Collection
    // app.get("/api/orders", async (req, res) => {
    //   const result = await orderFoodCollection.find().toArray();
    //   res.send(result);
    // });

    // Get Order By User Email (Private)
    app.get("/api/orders", verifyToken, async (req, res) => {
      const { email } = req.query;

      if (req.user.email !== email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const filter = { buyerEmail: email };
      const result = await orderFoodCollection.find(filter).toArray();
      res.send(result);
    });

    // Post / Add Order (Private)
    app.post("/api/orders", verifyToken, async (req, res) => {
      const { email } = req.query;
      if (req.user.email !== email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const order = req.body;
      const foodId = order.foodId;

      // Find The Food
      const query = { _id: new ObjectId(foodId) };
      const foodInfo = await foodCollection.findOne(query);

      const totalPurchaseCount = foodInfo.purchaseCount + order.orderQuantity;
      const totalQuantity = foodInfo.quantity - order.orderQuantity;
      const updateDoc = {
        $set: {
          purchaseCount: totalPurchaseCount,
          quantity: totalQuantity,
        },
      };
      const update = await foodCollection.updateOne(query, updateDoc);

      const result = await orderFoodCollection.insertOne(order);
      res.send(result);
    });

    // Delete Order (Private)
    app.delete("/api/orders/:id", verifyToken, async (req, res) => {
      const { email } = req.query;
      if (req.user.email !== email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await orderFoodCollection.deleteOne(query);
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Tastr Server Is Running...");
});

app.listen(port, () => {
  console.log(`Tastr server running on port ${port}`);
});
