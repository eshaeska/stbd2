// =====================================================================
// MongoDB (документна БД): телеметрія автопарку
// Запуск у mongosh:   mongosh < mongo_setup.js     (або load("mongo_setup.js"))
// =====================================================================
db = db.getSiblingDB("fleet_nosql");

db.telemetry_demo.drop();

// 1) Колекція з валідацією (необов'язкова схема)
db.createCollection("telemetry_demo", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["vehicle_id", "ts", "location"],
    properties: {
      vehicle_id: { bsonType: "number" },
      ts:         { bsonType: "date" },
      location:   { bsonType: "object", required: ["type", "coordinates"] },
      speed_kmh:  { bsonType: "number", minimum: 0 }
    }
  } }
});

// 2) Індекси
db.telemetry_demo.createIndex({ vehicle_id: 1, ts: -1 });   // історія авто за часом
db.telemetry_demo.createIndex({ dtc_codes: 1 });            // multikey: пошук за кодом помилки
db.telemetry_demo.createIndex({ location: "2dsphere" });    // гео-запити
// TTL: автоматично видаляти дані старші за 90 днів (за потреби)
// db.telemetry_demo.createIndex({ ts: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

// 3) INSERT. Документи мають РІЗНУ структуру (engine і dtc_codes необов'язкові)
db.telemetry_demo.insertMany([
  { vehicle_id: 1, ts: new Date("2026-01-01T08:00:00Z"),
    location: { type: "Point", coordinates: [30.52, 50.45] },
    speed_kmh: 62.5, fuel_level_pct: 71.2,
    engine: { rpm: 2100, coolant_temp_c: 92.5, load_pct: 40 } },
  { vehicle_id: 1, ts: new Date("2026-01-01T08:00:30Z"),
    location: { type: "Point", coordinates: [30.53, 50.46] },
    speed_kmh: 70.1, fuel_level_pct: 71.0,
    engine: { rpm: 2400, coolant_temp_c: 118, load_pct: 62 }, dtc_codes: ["P0300", "P0171"] },
  { vehicle_id: 2, ts: new Date("2026-01-01T08:00:00Z"),          // пристрій без даних двигуна
    location: { type: "Point", coordinates: [30.60, 50.40] },
    speed_kmh: 0, fuel_level_pct: 55.5 }
]);

// 4) SELECT (find)
db.telemetry_demo.find({ vehicle_id: 1 }).sort({ ts: -1 }).limit(5);                    // останні 5 точок авто
db.telemetry_demo.find({ vehicle_id: 1, ts: { $gte: new Date("2026-01-01T08:00:00Z"),
                                              $lt:  new Date("2026-01-01T14:00:00Z") } }); // діапазон часу
db.telemetry_demo.find({ dtc_codes: "P0300" }, { vehicle_id: 1, ts: 1, _id: 0 });       // за елементом масиву
db.telemetry_demo.find({ "engine.coolant_temp_c": { $gt: 110 } });                       // за вкладеним полем
db.telemetry_demo.find({ engine: { $exists: false } });                                  // без даних двигуна

// 5) Гео-запит: авто в радіусі 5 км від центру Києва
db.telemetry_demo.find({ location: { $near: {
  $geometry: { type: "Point", coordinates: [30.52, 50.45] }, $maxDistance: 5000 } } });

// 6) Агрегація: середня швидкість і температура по авто
db.telemetry_demo.aggregate([
  { $group: { _id: "$vehicle_id",
              avg_speed: { $avg: "$speed_kmh" },
              avg_temp:  { $avg: "$engine.coolant_temp_c" },
              n:         { $sum: 1 } } },
  { $sort: { _id: 1 } }
]);

// 7) UPDATE
db.telemetry_demo.updateOne({ vehicle_id: 2 }, { $set: { engine: { rpm: 800, coolant_temp_c: 85, load_pct: 10 } } });
db.telemetry_demo.updateOne({ vehicle_id: 1, ts: new Date("2026-01-01T08:00:00Z") },
                            { $push: { dtc_codes: "P0420" } });

// 8) DELETE
db.telemetry_demo.deleteMany({ vehicle_id: 2 });

// 9) План запиту (перевірка індексу)
db.telemetry_demo.find({ vehicle_id: 1 }).sort({ ts: -1 }).explain("executionStats");
