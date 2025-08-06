import React, { useRef, useEffect, useState, useCallback } from 'react';

const InfiniteCanvas = () => {
  const canvasRef = useRef(null);
  const [viewport, setViewport] = useState({
    x: 0,
    y: 0,
    zoom: 1
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [elements, setElements] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);

  // Initialize with some sample elements
  useEffect(() => {
    setElements([
      { id: 1, type: 'rect', x: 100, y: 100, width: 100, height: 80, color: '#ff6b6b' },
      { id: 2, type: 'circle', x: 300, y: 200, radius: 50, color: '#4ecdc4' },
      { id: 3, type: 'rect', x: -200, y: -100, width: 120, height: 60, color: '#45b7d1' },
      { id: 4, type: 'circle', x: -50, y: 300, radius: 40, color: '#96ceb4' },
    ]);
  }, []);

  // Transform screen coordinates to world coordinates
  const screenToWorld = useCallback((screenX, screenY) => {
    return {
      x: (screenX - viewport.x) / viewport.zoom,
      y: (screenY - viewport.y) / viewport.zoom
    };
  }, [viewport]);

  // Transform world coordinates to screen coordinates
  const worldToScreen = useCallback((worldX, worldY) => {
    return {
      x: worldX * viewport.zoom + viewport.x,
      y: worldY * viewport.zoom + viewport.y
    };
  }, [viewport]);

  // Check if element is visible in current viewport
  const isElementVisible = useCallback((element) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const padding = 100; // Buffer zone
    const left = -viewport.x / viewport.zoom - padding;
    const top = -viewport.y / viewport.zoom - padding;
    const right = left + (canvas.width / viewport.zoom) + padding * 2;
    const bottom = top + (canvas.height / viewport.zoom) + padding * 2;

    if (element.type === 'rect') {
      return !(element.x + element.width < left || 
               element.x > right || 
               element.y + element.height < top || 
               element.y > bottom);
    } else if (element.type === 'circle') {
      return !(element.x + element.radius < left || 
               element.x - element.radius > right || 
               element.y + element.radius < top || 
               element.y - element.radius > bottom);
    }
    return true;
  }, [viewport]);

  // Drawing function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save context state
    ctx.save();
    
    // Apply viewport transformation
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.zoom, viewport.zoom);
    
    // Draw grid
    drawGrid(ctx);
    
    // Draw elements (only visible ones)
    elements.filter(isElementVisible).forEach(element => {
      if (element.type === 'rect') {
        ctx.fillStyle = element.color;
        ctx.fillRect(element.x, element.y, element.width, element.height);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2 / viewport.zoom;
        ctx.strokeRect(element.x, element.y, element.width, element.height);
      } else if (element.type === 'circle') {
        ctx.beginPath();
        ctx.arc(element.x, element.y, element.radius, 0, 2 * Math.PI);
        ctx.fillStyle = element.color;
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2 / viewport.zoom;
        ctx.stroke();
      }
    });

    // Draw current path while drawing
    if (isDrawing && currentPath.length > 1) {
      ctx.beginPath();
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i].x, currentPath[i].y);
      }
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 3 / viewport.zoom;
      ctx.stroke();
    }
    
    // Restore context state
    ctx.restore();
    
    // Draw UI elements (zoom level, coordinates)
    drawUI(ctx);
  }, [viewport, elements, isElementVisible, isDrawing, currentPath]);

  // Draw grid
  const drawGrid = (ctx) => {
    const gridSize = 50;
    const left = Math.floor(-viewport.x / viewport.zoom / gridSize) * gridSize;
    const top = Math.floor(-viewport.y / viewport.zoom / gridSize) * gridSize;
    const right = left + Math.ceil(canvasRef.current.width / viewport.zoom / gridSize + 2) * gridSize;
    const bottom = top + Math.ceil(canvasRef.current.height / viewport.zoom / gridSize + 2) * gridSize;
    
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1 / viewport.zoom;
    
    // Vertical lines
    for (let x = left; x < right; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = top; y < bottom; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
  };

  // Draw UI overlay
  const drawUI = (ctx) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 200, 80);
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.fillText(`Zoom: ${(viewport.zoom * 100).toFixed(0)}%`, 20, 30);
    ctx.fillText(`Pan: (${viewport.x.toFixed(0)}, ${viewport.y.toFixed(0)})`, 20, 50);
    ctx.fillText(`Elements: ${elements.length}`, 20, 70);
  };

  // Zoom to cursor
  const zoomToCursor = useCallback((deltaY, clientX, clientY) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    
    const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, viewport.zoom * zoomFactor));
    
    if (newZoom !== viewport.zoom) {
      const worldPos = screenToWorld(mouseX, mouseY);
      
      setViewport(prev => ({
        zoom: newZoom,
        x: mouseX - worldPos.x * newZoom,
        y: mouseY - worldPos.y * newZoom
      }));
    }
  }, [viewport, screenToWorld]);

  // Handle wheel events
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      zoomToCursor(e.deltaY, e.clientX, e.clientY);
    } else if (e.shiftKey) {
      // Horizontal scroll
      setViewport(prev => ({
        ...prev,
        x: prev.x - e.deltaY
      }));
    } else {
      // Vertical scroll
      setViewport(prev => ({
        ...prev,
        y: prev.y - e.deltaY
      }));
    }
  }, [zoomToCursor]);

  // Handle mouse down
  const handleMouseDown = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (e.button === 1 || isSpacePressed) {
      // Middle mouse or space + click for panning
      setIsDragging(true);
      setDragStart({ x: mouseX - viewport.x, y: mouseY - viewport.y });
    } else if (e.button === 0 && !isSpacePressed) {
      // Left click for drawing
      const worldPos = screenToWorld(mouseX, mouseY);
      setIsDrawing(true);
      setCurrentPath([worldPos]);
    }
  }, [viewport, isSpacePressed, screenToWorld]);

  // Handle mouse move
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDragging) {
      setViewport(prev => ({
        ...prev,
        x: mouseX - dragStart.x,
        y: mouseY - dragStart.y
      }));
    } else if (isDrawing) {
      const worldPos = screenToWorld(mouseX, mouseY);
      setCurrentPath(prev => [...prev, worldPos]);
    }
  }, [isDragging, dragStart, isDrawing, screenToWorld]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
    if (isDrawing) {
      // Add the drawn path as a new element
      if (currentPath.length > 1) {
        setElements(prev => [...prev, {
          id: Date.now(),
          type: 'path',
          points: currentPath,
          color: '#333'
        }]);
      }
      setIsDrawing(false);
      setCurrentPath([]);
    }
  }, [isDragging, isDrawing, currentPath]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Draw on every frame
  useEffect(() => {
    draw();
  }, [draw]);

  // Canvas resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [draw]);

  const resetView = () => {
    setViewport({ x: 0, y: 0, zoom: 1 });
  };

  const zoomIn = () => {
    setViewport(prev => ({ ...prev, zoom: Math.min(5, prev.zoom * 1.2) }));
  };

  const zoomOut = () => {
    setViewport(prev => ({ ...prev, zoom: Math.max(0.1, prev.zoom / 1.2) }));
  };

  return (
    <div className="w-full h-screen bg-gray-100 relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{ cursor: isSpacePressed ? 'grab' : 'crosshair' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      
      {/* Controls */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 space-y-2">
        <button 
          onClick={zoomIn}
          className="block w-full px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Zoom In
        </button>
        <button 
          onClick={zoomOut}
          className="block w-full px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Zoom Out
        </button>
        <button 
          onClick={resetView}
          className="block w-full px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Reset View
        </button>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-sm">
        <h3 className="font-bold mb-2">Controls:</h3>
        <ul className="text-sm space-y-1">
          <li>🖱️ <strong>Scroll:</strong> Pan vertically</li>
          <li>⇧ <strong>Shift + Scroll:</strong> Pan horizontally</li>
          <li>⌃ <strong>Ctrl + Scroll:</strong> Zoom to cursor</li>
          <li>🖱️ <strong>Middle Click + Drag:</strong> Pan</li>
          <li>⌨️ <strong>Space + Click + Drag:</strong> Pan</li>
          <li>🖱️ <strong>Left Click + Drag:</strong> Draw</li>
        </ul>
      </div>
    </div>
  );
};

export default InfiniteCanvas;