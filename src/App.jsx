import { useEffect, useRef, useState } from 'react';




const LoginScreen = ({ onLogin }) => {
  const [userName, setUserName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (userName.trim()) {
      onLogin(userName.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <h2 className="text-xl font-bold mb-4">Join Whiteboard</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter your name"
            className="w-full p-2 border rounded mb-4"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          >
            Join
          </button>
        </form>
      </div>
    </div>
  );
};

const UserList = ({ users, currentUser }) => (
  <div className="bg-white p-4 rounded shadow-lg">
    <h3 className="font-bold mb-2">Participants ({users.length})</h3>
    <ul className="space-y-1">
      {users.map(user => (
        <li key={user.id} className="flex items-center">
          <span className={`${user.id === currentUser.id ? 'font-bold' : ''}`}>
            {user.name} {user.id === currentUser.id && '(You)'}
          </span>
        </li>
      ))}
    </ul>
  </div>
);

const Whiteboard = () => {
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [currentActivity, setCurrentActivity] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [textSize, setTextSize] = useState(20);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [touchCount, setTouchCount] = useState(0);
  const [initialTouchDistance, setInitialTouchDistance] = useState(null);
  const [initialScale, setInitialScale] = useState(1);
  const [roomId, setRoomId] = useState(() => {
    // Get room from URL or generate a random one
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || Math.random().toString(36).substring(7);
  });
  const [activity,setActivity]=useState("draw")


  const applyDrawCommand = (data) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    switch (data.type) {
      case 'draw':
        handleRemoteDrawing(data)
        break;
      
      case 'text':
        ctx.font = `${data.textSize}px Arial`;
        ctx.fillStyle = data.color;
        ctx.fillText(data.text, data.x, data.y);
        break;

      case 'background':
        updateBackground(data.color);
        break;

      case 'clear':
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        break;
    }
  };

  const handleHistory = (history) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas before applying history
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply each command in order
    history.commands.forEach(command => {
      
      
      applyDrawCommand(command.payload);
    });
  };


  

  useEffect(() => {
    window.history.replaceState(null, '', `?room=${roomId}`);

    const wsUrl = `https://kiti-backend.onrender.com/ws?room=${roomId}`;
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onmessage = (event) => {
      
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'history':
          handleHistory(data);
          break;
        case 'userList':
          setUsers(data.users);
          break;
        case 'join':
          setCurrentActivity(`${data.userName} joined`);
          setTimeout(() => setCurrentActivity(null), 2000);
          break;
        case 'leave':
          setCurrentActivity(`${data.userName} left`);
          setTimeout(() => setCurrentActivity(null), 2000);
          break;
        case 'draw':
        case 'background':
        case 'text':
        case 'clear':
          applyDrawCommand(data);
          if (data.userId !== user.id) {
            setCurrentActivity(`${data.userName} is drawing`);
            setTimeout(() => setCurrentActivity(null), 1000);
          }
          break;
      }
    };

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [user,roomId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const resizeCanvas = () => {
      // Save the current content
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(canvas, 0, 0);
      
      // Resize canvas
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Set canvas properties
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = brushSize;
      
      // Restore content
      ctx.drawImage(tempCanvas, 0, 0);
      updateBackground(backgroundColor);
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  useEffect(() => {
    // Initialize canvas with background color
    updateBackground(backgroundColor);
  }, []);

  const updateBackground = (newColor) => {
    const canvas = canvasRef.current;
    
    canvas.style.backgroundColor=newColor
    
    
    
  };

  const changeBackground = (newColor) => {
    setBackgroundColor(newColor);
    updateBackground(newColor);
    
    // Broadcast background change
    wsRef.current.send(JSON.stringify({
      type: 'background',
      color: newColor
    }));
  };


  const redrawCanvas = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.setTransform(scale, 0, 0, scale, offset.x, offset.y);
  };

  const getPointerPos = (e) => {
     const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX || e.touches[0].clientX) - rect.left - offset.x) / scale;
    const y = ((e.clientY || e.touches[0].clientY) - rect.top - offset.y) / scale;
    return { x, y };
  };

  const getTouchDistance = (touch1, touch2) => {
    return Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
  };

  const startDrawing = (e) => {
    const pos = getPointerPos(e);
    setIsDrawing(true);
    setLastPos(pos);
    
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const pos = getPointerPos(e);
    const ctx = canvasRef.current.getContext('2d');

    const movementX = pos.x - lastPos.x;
    const movementY = pos.y - lastPos.y;
    
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.stroke();
    
    setLastPos(pos);

    // Send drawing data to server
    const drawData = {
      type: 'draw',
      prevX: pos.x - movementX,
      prevY: pos.y - movementY,
      currX: pos.x,
      currY: pos.y,
      color: color,
      brushSize: brushSize,
    };
    

    wsRef.current.send(JSON.stringify(drawData));
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    setTouchCount(e.touches.length);

    if (e.touches.length === 1) {
      startDrawing(e.touches[0]);
    } else if (e.touches.length === 2) {
      setIsDrawing(false);
      setInitialTouchDistance(getTouchDistance(e.touches[0], e.touches[1]));
      setInitialScale(scale);
    }
  };

  const handleTouchMove = (e) => {
  
    
    if (e.touches.length === 1 && isDrawing) {
      draw(e.touches[0]);
    } else if (e.touches.length === 2) {
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      const newScale = (currentDistance / initialTouchDistance) * initialScale;
      
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      
      setScale(Math.min(Math.max(newScale, 0.5), 3));
      redrawCanvas();
    }
  
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    setTouchCount(e.touches.length);
    if (e.touches.length === 0) {
      stopDrawing();
    }
  };

  const handleRemoteDrawing = (drawData) => {
    const ctx = canvasRef.current.getContext('2d');
    
    const { prevX, prevY, currX, currY, color: remoteColor, brushSize: remoteBrushSize } = drawData;
    
    ctx.beginPath();
    ctx.moveTo(prevX * scale + offset.x, prevY * scale + offset.y);
    ctx.lineTo(currX * scale + offset.x, currY * scale + offset.y);
    ctx.strokeStyle = remoteColor;
    ctx.lineWidth = remoteBrushSize;
    ctx.stroke();
  };

  const handleText=(e)=>{
   
    const ctx = canvasRef.current.getContext('2d');
    ctx.font = `${textSize}px Arial`;
    const input = document.createElement('input');
    input.type = 'text';
    input.style.position = 'absolute';
    input.style.left = e.clientX + 'px';
    input.style.top = e.clientY + 'px';
    input.style.color = color;
    input.style.fontSize = textSize + 'px';

    document.body.appendChild(input);
    input.focus();

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const ctx = canvasRef.current.getContext('2d');
        ctx.font = `${textSize}px Arial`;
        ctx.fillStyle = color;
        const pos = getPointerPos(e);
        ctx.fillText(input.value, pos.x, pos.y);

        wsRef.current.send(JSON.stringify({
          type: 'text',
          text: input.value,
          x: pos.x,
          y: pos.y,
          color: color,
          textSize
        }));

        document.body.removeChild(input);
      }
      if (event.key === 'Escape') {
        document.body.removeChild(input);
      }


    });






  


  
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offset.x, offset.y);
    updateBackground(backgroundColor);
    wsRef.current.send(JSON.stringify({ type: 'clear' }));
  };

  // if (!user) {
  //   return <LoginScreen onLogin={(userName) => setUser({ id: Date.now().toString(), name: userName })} />;
  // }

   return (
    <div className="flex flex-col  items-center">
      <div className='bg-zinc-900 text-white p-4 fixed rounded-md '>
      <div className="w-full  max-w-3xl flex justify-between items-center mb-4">
    <div className="flex flex-col gap-4">
          <div className="text-lg font-semibold">Room: {roomId}</div>
          {/* <UserList users={users} currentUser={user} /> */}
          {currentActivity && (
            <div className="bg-blue-100 p-2 rounded">
              {currentActivity}
            </div>
          )}
        </div>
        <button
          onClick={() => {
            const newRoomId = Math.random().toString(36).substring(7);
            setRoomId(newRoomId);
          }}
          className="px-4 py-2 rounded-full bg-amber-500 text-white rounded hover:bg-amber-600"
        >
          Create New Room
        </button>
      </div>
      <div className="flex  flex-col gap-4 mb-4 w-full max-w-3xl">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Brush Color</span>
            <div className="flex gap-2">
              
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8"
                title="Custom Color"
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Background Color</span>
            <div className="flex gap-2">
              
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => changeBackground(e.target.value)}
                className="w-8 h-8"
                title="Custom Background"
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Brush Size</span>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-32"
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Text Size</span>
            <input
              type="range"
              min="10"
              max="50"
              value={textSize}
              onChange={(e) => setTextSize(parseInt(e.target.value))}
              className="w-32"
            />
          </div>



          <div className="flex flex-col gap-2">
            <button className={`border-2 rounded-sm p-2 hover:bg-zinc-800 ${activity==="text"?"bg-white text-black":""}`} onClick={()=>{setActivity("text")}}>Text</button>
          </div>
          <div className="flex flex-col gap-2">
            <button className={`border-2 rounded-sm p-2 hover:bg-zinc-800 ${activity==="draw"?"bg-white text-black":""}`} onClick={()=>{setActivity("draw")}}>Draw</button>
          </div>
          
          <button
            onClick={clearCanvas}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear
          </button>
        </div>
      </div>
      </div>
   
      
      
        <canvas
        width={window.innerWidth}
        height={window.innerHeight}
          ref={canvasRef}
          onMouseDown={(e)=>{
          if(activity==="draw"){
          startDrawing(e)
          }
          else{
            handleText(e)
          }
          
          
          }}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`border border-gray-300  rounded shadow-lg`}
        />
      
    </div>
  );
};

export default Whiteboard;