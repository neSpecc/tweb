interface Point { x: number; y: number }

function getSquaredDistance(point1: Point, point2: Point): number {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return dx * dx + dy * dy;
}

function getPerpendicularDistance(point: Point, lineStart: Point, lineEnd: Point) {
  const lineLengthSquared = getSquaredDistance(lineStart, lineEnd);
  if(lineLengthSquared === 0)
    return getSquaredDistance(point, lineStart);

  const t = ((point.x - lineStart.x) * (lineEnd.x - lineStart.x) + (point.y - lineStart.y) * (lineEnd.y - lineStart.y)) / lineLengthSquared;
  if(t < 0)
    return getSquaredDistance(point, lineStart);
  if(t > 1)
    return getSquaredDistance(point, lineEnd);

  const projection = {
    x: lineStart.x + t * (lineEnd.x - lineStart.x),
    y: lineStart.y + t * (lineEnd.y - lineStart.y)
  };
  return getSquaredDistance(point, projection);
}

export function ramerDouglasPeucker(points: Point[], epsilon: number): Point[] {
  if(points.length < 3)
    return points;

  let maxDistance = 0;
  let index = 0;

  for(let i = 1; i < points.length - 1; i++) {
    const distance = getPerpendicularDistance(points[i], points[0], points[points.length - 1]);
    if(distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }

  if(maxDistance > epsilon) {
    const left = ramerDouglasPeucker(points.slice(0, index + 1), epsilon);
    const right = ramerDouglasPeucker(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  }
  else {
    return [points[0], points[points.length - 1]];
  }
}
