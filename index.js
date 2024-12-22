const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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
    await client.connect();
    const foodCollection = client.db("tastrDB").collection("foods");
    const orderFoodCollection = client.db("tastrDB").collection("orders");

    // GET Food Collection
    app.get("/api/foods", async (req, res) => {
      const { search } = req.query;

      let query = {};
      if (search) {
        query = { name: { $regex: search, $options: "i" } };
      }

      const result = await foodCollection.find(query).toArray();
      res.send(result);
    });

    // GET Top Foods
    app.get("/api/top-foods", async (req, res) => {
      const options = {
        sort: { purchaseCount: -1 },
      };

      const result = await foodCollection.find({}, options).limit(6).toArray();
      res.send(result);
    });

    // GET Food By Id
    app.get("/api/foods/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await foodCollection.findOne(query);
      res.send(result);
    });

    // Order Collection
    // Get Order Collection
    // app.get("/api/orders", async (req, res) => {
    //   const result = await orderFoodCollection.find().toArray();
    //   res.send(result);
    // });

    // Get Order By User Email
    app.get("/api/orders", async (req, res) => {
      const { email } = req.query;
      const filter = { buyerEmail: email };
      const result = await orderFoodCollection.find(filter).toArray();
      res.send(result);
    });

    // Post / Add Order
    app.post("/api/orders", async (req, res) => {
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

    // Delete Order
    app.delete("/api/orders/:id", async (req, res) => {
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
