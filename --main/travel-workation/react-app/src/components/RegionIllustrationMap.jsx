import { useEffect, useLayoutEffect, useRef, useState } from "react";
import jeonnamSvg from "../assets/maps/jeonnam.svg?raw";
import jeonbukSvg from "../assets/maps/jeonbuk.svg?raw";
import gwangjuSvg from "../assets/maps/gwangju.svg?raw";

const MAP_WIDTH = 800;
const MAP_HEIGHT = 900;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const MAX_PAN_SENSITIVITY = 2.4;
const MIN_PAN_X = MAP_WIDTH * .18;
const MIN_PAN_Y = MAP_HEIGHT * .18;

const labelOffsets = {
  완주: { x: 35, y: -16 },
  나주: { x: 28, y: 18 },
  여수: { x: 12, y: -24 }
};

function readPaths(svgText) {
  return [...svgText.matchAll(/<path\b([^>]*)\/>/g)].map(([, attributes]) => ({
    id: attributes.match(/\bid="([^"]+)"/)?.[1] || "",
    d: attributes.match(/\bd="([^"]+)"/)?.[1] || "",
    fillRule: attributes.match(/\bfill-rule="([^"]+)"/)?.[1] || "nonzero"
  })).filter(({ id, d }) => id && d);
}

const jeonnamPaths = readPaths(jeonnamSvg);
const jeonbukPaths = readPaths(jeonbukSvg);
const gwangjuPaths = readPaths(gwangjuSvg);

function shortName(name) {
  return name.replace(/(특별자치도|광역시|특별시|자치시|시|군|구)$/u, "");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function RegionShape({ path, province, item, selected, onSelect, onHover }) {
  const pathRef = useRef(null);
  const [labelPoint, setLabelPoint] = useState(null);
  const name = shortName(path.id);

  useLayoutEffect(() => {
    if (!pathRef.current) return;
    const box = pathRef.current.getBBox();
    const adjustment = labelOffsets[name] || { x: 0, y: 0 };
    setLabelPoint({ x: box.x + box.width / 2 + adjustment.x, y: box.y + box.height / 2 + adjustment.y });
  }, [path.d]);

  return <g className="region-map-area" data-region={name}>
    <path
      ref={pathRef}
      className={`region-map-shape${selected ? " is-selected" : ""}`}
      d={path.d}
      fillRule={path.fillRule}
      role="button"
      tabIndex="0"
      aria-label={`${province} ${name} 지역 선택`}
      aria-pressed={selected}
      onMouseEnter={() => onHover(name)}
      onMouseLeave={() => onHover("")}
      onFocus={() => onHover(name)}
      onBlur={() => onHover("")}
      onClick={() => onSelect(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(item);
        }
      }}
    ><title>{name}</title></path>
    {labelPoint && <text className="region-map-label" x={labelPoint.x} y={labelPoint.y}>{name}</text>}
  </g>;
}

function RegionPaths({ paths, province, itemsByName, selectedName, onSelect, onHover }) {
  return paths.map((path) => {
    const name = shortName(path.id);
    return <RegionShape
      key={`${province}-${path.id}`}
      path={path}
      province={province}
      item={itemsByName.get(name) || { name }}
      selected={shortName(selectedName || "") === name}
      onSelect={onSelect}
      onHover={onHover}
    />;
  });
}

export default function RegionIllustrationMap({ items = [], selectedName, onSelect }) {
  const [hoveredName, setHoveredName] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const mapRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const itemsByName = new Map(items.map((item) => [shortName(item.name || ""), item]));

  const changeZoom = (nextZoom) => {
    const value = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    setZoom(value);
    if (value === MIN_ZOOM) setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const handleWheel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setZoom((currentZoom) => clamp(currentZoom + (event.deltaY < 0 ? .28 : -.28), MIN_ZOOM, MAX_ZOOM));
    };
    map.addEventListener("wheel", handleWheel, { passive: false });
    return () => map.removeEventListener("wheel", handleWheel);
  }, []);

  const selectRegion = (item) => {
    if (suppressClickRef.current) return;
    onSelect(item);
  };

  const handlePointerDown = (event) => {
    dragRef.current = { x: event.clientX, y: event.clientY, originX: offset.x, originY: offset.y, moved: false };
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const panSensitivity = Math.min(MAX_PAN_SENSITIVITY, 1 + (zoom - 1) * .35);
    const dx = (event.clientX - dragRef.current.x) * MAP_WIDTH / bounds.width * panSensitivity;
    const dy = (event.clientY - dragRef.current.y) * MAP_HEIGHT / bounds.height * panSensitivity;
    if (!dragRef.current.moved && (Math.abs(event.clientX - dragRef.current.x) > 4 || Math.abs(event.clientY - dragRef.current.y) > 4)) {
      dragRef.current.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const limitX = Math.max(MIN_PAN_X, MAP_WIDTH * (zoom - 1) / 2);
    const limitY = Math.max(MIN_PAN_Y, MAP_HEIGHT * (zoom - 1) / 2);
    setOffset({
      x: clamp(dragRef.current.originX + dx, -limitX, limitX),
      y: clamp(dragRef.current.originY + dy, -limitY, limitY)
    });
  };

  const finishDragging = (event) => {
    if (dragRef.current?.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
    if (event?.currentTarget?.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  return <div ref={mapRef} className="region-illustration-map" aria-label="전라도 행정구역 선택 지도">
    <div className="region-map-toolbar" aria-label="지도 확대 축소">
      <button type="button" onClick={() => changeZoom(zoom + .35)} aria-label="지도 확대">＋</button>
      <button type="button" onClick={() => changeZoom(zoom - .35)} aria-label="지도 축소">−</button>
      <button type="button" className="region-map-reset" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}>초기화</button>
    </div>
    {(hoveredName || selectedName) && <div className="region-map-current" aria-live="polite">
      {hoveredName || selectedName}
    </div>}
    <svg
      className="region-boundary-map is-zoomed"
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDragging}
      onPointerCancel={finishDragging}
    >
      <rect className="region-map-sea" width={MAP_WIDTH} height={MAP_HEIGHT} rx="28" />
      <g transform={`translate(${MAP_WIDTH / 2 + offset.x} ${MAP_HEIGHT / 2 + offset.y}) scale(${zoom}) translate(${-MAP_WIDTH / 2} ${-MAP_HEIGHT / 2})`}>
        <svg x="56" y="18" width="688" height="375" viewBox="0 0 800 436" aria-label="전북 지역">
          <RegionPaths paths={jeonbukPaths} province="전북" itemsByName={itemsByName} selectedName={selectedName} onSelect={selectRegion} onHover={setHoveredName} />
        </svg>
        <svg x="0" y="348" width="800" height="519" viewBox="0 0 800 519" aria-label="전남 지역">
          <RegionPaths paths={jeonnamPaths} province="전남" itemsByName={itemsByName} selectedName={selectedName} onSelect={selectRegion} onHover={setHoveredName} />
        </svg>
        <svg className="gwangju-map-shape" x="382" y="449" width="105" height="72" viewBox="0 0 800 545" aria-label="광주 지역" role="button" tabIndex="0"
          onMouseEnter={() => setHoveredName("광주")} onMouseLeave={() => setHoveredName("")} onFocus={() => setHoveredName("광주")} onBlur={() => setHoveredName("")}
          onClick={() => selectRegion(itemsByName.get("광주") || { name: "광주" })}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") selectRegion(itemsByName.get("광주") || { name: "광주" }); }}>
          <g className={`region-map-shape-group${shortName(selectedName || "") === "광주" ? " is-selected" : ""}`}>
            {gwangjuPaths.map((path) => <path key={path.id} d={path.d} fillRule={path.fillRule}><title>광주</title></path>)}
            <text className="region-map-label region-map-label-gwangju" x="430" y="300">광주</text>
          </g>
        </svg>
      </g>
    </svg>
  </div>;
}
