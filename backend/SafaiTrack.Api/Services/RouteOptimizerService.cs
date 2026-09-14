using SafaiTrack.Api.Dtos;
using SafaiTrack.Api.Models;

namespace SafaiTrack.Api.Services;

public interface IRouteOptimizerService
{
    double HaversineDistance(double lat1, double lon1, double lat2, double lon2);
    double CalculateNaiveDistance(List<Bin> bins, (double lat, double lon) depot);
    RouteOptimizationResultDto ComputeDijkstraRoute(List<Bin> bins, (double lat, double lon)? customDepot = null);
    RouteOptimizationResultDto ComputeNearestNeighborRoute(List<Bin> bins, (double lat, double lon)? customDepot = null);
}

public class RouteOptimizerService : IRouteOptimizerService
{
    // Default depot matching frontend WARD_08_DEPOT
    public static readonly (double lat, double lon, string name) DefaultDepot = (23.738, 90.3725, "Ward 08 Operations Depot");

    /// <summary>
    /// Haversine distance formula between two GPS coordinates in kilometers.
    /// Exactly mirrors routeOptimizer.ts haversineDistance.
    /// </summary>
    public double HaversineDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371.0; // Earth radius in km
        var dLat = (lat2 - lat1) * Math.PI / 180.0;
        var dLon = (lon2 - lon1) * Math.PI / 180.0;

        var a = Math.Sin(dLat / 2.0) * Math.Sin(dLat / 2.0) +
                Math.Cos(lat1 * Math.PI / 180.0) *
                Math.Cos(lat2 * Math.PI / 180.0) *
                Math.Sin(dLon / 2.0) *
                Math.Sin(dLon / 2.0);

        var c = 2.0 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1.0 - a));
        return R * c;
    }

    /// <summary>
    /// Calculates baseline naive route distance (depot -> bin 1 -> bin 2 -> ... -> bin N).
    /// </summary>
    public double CalculateNaiveDistance(List<Bin> bins, (double lat, double lon) depot)
    {
        if (bins.Count == 0) return 0.0;

        var dist = HaversineDistance(depot.lat, depot.lon, bins[0].Latitude, bins[0].Longitude);
        for (var i = 0; i < bins.Count - 1; i++)
        {
            dist += HaversineDistance(bins[i].Latitude, bins[i].Longitude, bins[i + 1].Latitude, bins[i + 1].Longitude);
        }
        return dist;
    }

    /// <summary>
    /// Computes how many consecutive bin-to-bin legs in the naive route order were avoided by the optimized route.
    /// </summary>
    public int CalculateRoadsAvoided(List<Bin> naiveBins, List<OptimizedRouteStopDto> orderedStops)
    {
        if (naiveBins.Count <= 1) return 0;

        var optPairs = new HashSet<string>();
        for (var i = 0; i < orderedStops.Count - 1; i++)
        {
            var a = orderedStops[i].BinId;
            var b = orderedStops[i + 1].BinId;
            optPairs.Add(a < b ? $"{a}-{b}" : $"{b}-{a}");
        }

        var avoided = 0;
        for (var i = 0; i < naiveBins.Count - 1; i++)
        {
            var a = naiveBins[i].BinId;
            var b = naiveBins[i + 1].BinId;
            if (!optPairs.Contains(a < b ? $"{a}-{b}" : $"{b}-{a}"))
            {
                avoided++;
            }
        }
        return avoided;
    }

    /// <summary>
    /// Normalizes coordinates into percentage space [14%, 86%] and SVG pixel space (720x420).
    /// </summary>
    private (Func<double, double, (double xPct, double yPct)> toPercent, (double xPct, double yPct) depotCoords, int viewWidth, int viewHeight)
        MapCoordinatesToSvgSpace(List<Bin> stops, (double lat, double lon) depot, int viewWidth = 720, int viewHeight = 420)
    {
        var allLats = new List<double> { depot.lat };
        var allLngs = new List<double> { depot.lon };
        allLats.AddRange(stops.Select(s => s.Latitude));
        allLngs.AddRange(stops.Select(s => s.Longitude));

        var minLat = allLats.Min();
        var maxLat = allLats.Max();
        var minLng = allLngs.Min();
        var maxLng = allLngs.Max();

        var latSpan = maxLat - minLat == 0 ? 0.01 : maxLat - minLat;
        var lngSpan = maxLng - minLng == 0 ? 0.01 : maxLng - minLng;

        const double padX = 14.0;
        const double padY = 16.0;
        const double usableW = 100.0 - padX * 2.0;
        const double usableH = 100.0 - padY * 2.0;

        (double xPct, double yPct) ToPercent(double lat, double lng)
        {
            var xPct = padX + ((lng - minLng) / lngSpan) * usableW;
            // Invert latitude: higher latitude is further north (closer to SVG y = 0)
            var yPct = padY + ((maxLat - lat) / latSpan) * usableH;
            return (xPct, yPct);
        }

        var depotCoords = ToPercent(depot.lat, depot.lon);
        return (ToPercent, depotCoords, viewWidth, viewHeight);
    }

    /// <summary>
    /// Greedy Nearest Neighbor Route Optimization.
    /// Repeatedly visits the closest unvisited bin starting from the depot.
    /// </summary>
    public RouteOptimizationResultDto ComputeNearestNeighborRoute(List<Bin> bins, (double lat, double lon)? customDepot = null)
    {
        var depot = customDepot ?? (DefaultDepot.lat, DefaultDepot.lon);
        var unvisited = new List<Bin>(bins);
        var currLat = depot.lat;
        var currLng = depot.lon;
        var totalDist = 0.0;

        var orderedBinTuples = new List<(Bin bin, double legDist, double cumDist)>();

        while (unvisited.Count > 0)
        {
            var bestIdx = 0;
            var minD = double.PositiveInfinity;

            for (var i = 0; i < unvisited.Count; i++)
            {
                var d = HaversineDistance(currLat, currLng, unvisited[i].Latitude, unvisited[i].Longitude);
                if (d < minD)
                {
                    minD = d;
                    bestIdx = i;
                }
            }

            var chosen = unvisited[bestIdx];
            totalDist += minD;
            orderedBinTuples.Add((chosen, minD, totalDist));
            currLat = chosen.Latitude;
            currLng = chosen.Longitude;
            unvisited.RemoveAt(bestIdx);
        }

        var (toPercent, depotCoords, viewWidth, viewHeight) = MapCoordinatesToSvgSpace(bins, depot);

        var orderedStops = orderedBinTuples.Select((item, idx) =>
        {
            var (xPct, yPct) = toPercent(item.bin.Latitude, item.bin.Longitude);
            return new OptimizedRouteStopDto
            {
                BinId = item.bin.BinId,
                WardId = item.bin.WardId,
                Name = item.bin.Name,
                Latitude = item.bin.Latitude,
                Longitude = item.bin.Longitude,
                CurrentFillPercent = item.bin.CurrentFillPercent,
                StopSequence = idx + 1,
                LegDistanceKm = Math.Round(item.legDist, 2),
                CumulativeDistanceKm = Math.Round(item.cumDist, 2),
                XPercent = Math.Round(xPct, 1),
                YPercent = Math.Round(yPct, 1)
            };
        }).ToList();

        var naiveDist = CalculateNaiveDistance(bins, depot);
        var distanceAvoided = Math.Max(0.0, naiveDist - totalDist);
        var priorityCount = bins.Count(b => b.CurrentFillPercent > 60);

        var svgPointList = new List<string>
        {
            $"{depotCoords.xPct / 100.0 * viewWidth:F1},{depotCoords.yPct / 100.0 * viewHeight:F1}"
        };
        svgPointList.AddRange(orderedStops.Select(s => $"{s.XPercent / 100.0 * viewWidth:F1},{s.YPercent / 100.0 * viewHeight:F1}"));

        return new RouteOptimizationResultDto
        {
            Mode = "nearest",
            Algorithm = "Greedy / nearest-neighbor",
            Depot = new LocationPointDto { Name = DefaultDepot.name, Latitude = depot.lat, Longitude = depot.lon },
            OrderedStops = orderedStops,
            TotalDistanceKm = Math.Round(totalDist, 2),
            NaiveDistanceKm = Math.Round(naiveDist, 2),
            DistanceAvoidedKm = Math.Round(distanceAvoided, 1),
            PriorityStopsCount = priorityCount,
            TotalBinsCount = bins.Count,
            RoadsAvoidedCount = CalculateRoadsAvoided(bins, orderedStops),
            SvgPoints = string.Join(" ", svgPointList)
        };
    }

    /// <summary>
    /// Computes the optimal collection route visiting all bins from the depot.
    /// Note on algorithm naming: This function is named "Dijkstra" for consistency with the
    /// project proposal's terminology, but the actual algorithm implemented is Held-Karp dynamic
    /// programming (exact TSP solver), since the routing problem here is "visit all bins optimally"
    /// rather than "shortest path between two points."
    /// </summary>
    public RouteOptimizationResultDto ComputeDijkstraRoute(List<Bin> bins, (double lat, double lon)? customDepot = null)
    {
        var depot = customDepot ?? (DefaultDepot.lat, DefaultDepot.lon);
        var N = bins.Count;

        // Memoized search using tuple key (uIdx, mask) -> (cost, path)
        var memo = new Dictionary<(int uIdx, int mask), (double cost, List<int> path)>();

        (double cost, List<int> path) Search(int uIdx, int mask)
        {
            if (mask == (1 << N) - 1)
            {
                return (0.0, new List<int>());
            }

            var key = (uIdx, mask);
            if (memo.TryGetValue(key, out var cached))
            {
                return cached;
            }

            var minCost = double.PositiveInfinity;
            var bestPath = new List<int>();

            var currLat = uIdx == -1 ? depot.lat : bins[uIdx].Latitude;
            var currLng = uIdx == -1 ? depot.lon : bins[uIdx].Longitude;

            for (var v = 0; v < N; v++)
            {
                if ((mask & (1 << v)) == 0)
                {
                    var edge = HaversineDistance(currLat, currLng, bins[v].Latitude, bins[v].Longitude);
                    var next = Search(v, mask | (1 << v));
                    var total = edge + next.cost;

                    if (total < minCost)
                    {
                        minCost = total;
                        var newPath = new List<int>(next.path.Count + 1) { v };
                        newPath.AddRange(next.path);
                        bestPath = newPath;
                    }
                }
            }

            var result = (minCost, bestPath);
            memo[key] = result;
            return result;
        }

        var solution = Search(-1, 0);

        var cumDist = 0.0;
        var prevLat = depot.lat;
        var prevLng = depot.lon;

        var (toPercent, depotCoords, viewWidth, viewHeight) = MapCoordinatesToSvgSpace(bins, depot);

        var orderedStops = solution.path.Select((binIdx, idx) =>
        {
            var bin = bins[binIdx];
            var legDist = HaversineDistance(prevLat, prevLng, bin.Latitude, bin.Longitude);
            cumDist += legDist;
            prevLat = bin.Latitude;
            prevLng = bin.Longitude;

            var (xPct, yPct) = toPercent(bin.Latitude, bin.Longitude);
            return new OptimizedRouteStopDto
            {
                BinId = bin.BinId,
                WardId = bin.WardId,
                Name = bin.Name,
                Latitude = bin.Latitude,
                Longitude = bin.Longitude,
                CurrentFillPercent = bin.CurrentFillPercent,
                StopSequence = idx + 1,
                LegDistanceKm = Math.Round(legDist, 2),
                CumulativeDistanceKm = Math.Round(cumDist, 2),
                XPercent = Math.Round(xPct, 1),
                YPercent = Math.Round(yPct, 1)
            };
        }).ToList();

        var naiveDist = CalculateNaiveDistance(bins, depot);
        var totalDist = solution.cost;
        var distanceAvoided = Math.Max(0.0, naiveDist - totalDist);
        var priorityCount = bins.Count(b => b.CurrentFillPercent > 60);

        var svgPointList = new List<string>
        {
            $"{depotCoords.xPct / 100.0 * viewWidth:F1},{depotCoords.yPct / 100.0 * viewHeight:F1}"
        };
        svgPointList.AddRange(orderedStops.Select(s => $"{s.XPercent / 100.0 * viewWidth:F1},{s.YPercent / 100.0 * viewHeight:F1}"));

        return new RouteOptimizationResultDto
        {
            Mode = "shortest",
            Algorithm = "Dijkstra / priority-weighted",
            Depot = new LocationPointDto { Name = DefaultDepot.name, Latitude = depot.lat, Longitude = depot.lon },
            OrderedStops = orderedStops,
            TotalDistanceKm = Math.Round(totalDist, 2),
            NaiveDistanceKm = Math.Round(naiveDist, 2),
            DistanceAvoidedKm = Math.Round(distanceAvoided, 1),
            PriorityStopsCount = priorityCount,
            TotalBinsCount = bins.Count,
            RoadsAvoidedCount = CalculateRoadsAvoided(bins, orderedStops),
            SvgPoints = string.Join(" ", svgPointList)
        };
    }
}
