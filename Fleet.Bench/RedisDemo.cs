using StackExchange.Redis;

namespace Fleet.Bench;

public static class RedisDemo
{
    public static async Task RunAsync()
    {
        await using var redis = await ConnectionMultiplexer.ConnectAsync("localhost:6379");
        var db = redis.GetDatabase();
        Console.WriteLine("PING: " + await db.PingAsync());

        await db.StringSetAsync("vehicle:1:online", "1", TimeSpan.FromSeconds(60));
        Console.WriteLine($"vehicle:1:online = {await db.StringGetAsync("vehicle:1:online")}, TTL = {await db.KeyTimeToLiveAsync("vehicle:1:online")}");

        await db.KeyDeleteAsync("trips:today");
        await db.StringIncrementAsync("trips:today");
        await db.StringIncrementAsync("trips:today");
        Console.WriteLine("trips:today = " + await db.StringGetAsync("trips:today"));

        await db.HashSetAsync("vehicle:1:last", new[]
        {
            new HashEntry("lat", 50.45), new HashEntry("lon", 30.52), new HashEntry("speed", 62.5)
        });
        Console.WriteLine("vehicle:1:last.speed = " + await db.HashGetAsync("vehicle:1:last", "speed"));
        foreach (var e in await db.HashGetAllAsync("vehicle:1:last"))
            Console.WriteLine($"  {e.Name} = {e.Value}");

        await db.KeyDeleteAsync("vehicles:geo");
        await db.GeoAddAsync("vehicles:geo", 30.52, 50.45, "vehicle:1");
        await db.GeoAddAsync("vehicles:geo", 30.60, 50.40, "vehicle:2");
        await db.GeoAddAsync("vehicles:geo", 30.90, 50.10, "vehicle:3");
        var near = await db.GeoSearchAsync("vehicles:geo", 30.52, 50.45,
            new GeoSearchCircle(15, GeoUnit.Kilometers), order: Order.Ascending,
            options: GeoRadiusOptions.WithDistance);
        Console.WriteLine("Авто в радіусі 15 км:");
        foreach (var r in near) Console.WriteLine($"  {r.Member} : {r.Distance:F2} км");

        await db.KeyDeleteAsync("drivers:km:today");
        await db.SortedSetAddAsync("drivers:km:today", "driver:10", 120.5);
        await db.SortedSetAddAsync("drivers:km:today", "driver:11", 340);
        await db.SortedSetAddAsync("drivers:km:today", "driver:12", 75.2);
        Console.WriteLine("Топ-3 водіїв:");
        foreach (var e in await db.SortedSetRangeByRankWithScoresAsync("drivers:km:today", 0, 2, Order.Descending))
            Console.WriteLine($"  {e.Element} : {e.Score} км");

        await db.KeyDeleteAsync("vehicles:in_trip");
        await db.SetAddAsync("vehicles:in_trip", new RedisValue[] { 1, 2, 3 });
        Console.WriteLine("У рейсі: " + await db.SetLengthAsync("vehicles:in_trip") +
                          ", авто 2 у рейсі: " + await db.SetContainsAsync("vehicles:in_trip", 2));
    }
}
