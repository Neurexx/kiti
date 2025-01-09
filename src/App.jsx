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
  const [roomId, setRoomId] = useState(() => {
    // Get room from URL or generate a random one
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || Math.random().toString(36).substring(7);
  });


  const applyDrawCommand = (data) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    switch (data.type) {
      case 'draw':
        ctx.beginPath();
        ctx.moveTo(data.prevX, data.prevY);
        ctx.lineTo(data.currX, data.currY);
        ctx.strokeStyle = data.color;
        ctx.lineWidth = data.brushSize;
        ctx.stroke();
        ctx.closePath();
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

    wsRef.current.onopen=(event)=>{
    }
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
    // Initialize canvas with background color
    updateBackground(backgroundColor);
  }, []);

  const updateBackground = (newColor) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Save the current canvas content
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);
    
    // Fill with new background color
    ctx.fillStyle = newColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Restore the content
    ctx.drawImage(tempCanvas, 0, 0);
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

  // const drawRemote = (data) => {
  //   const canvas = canvasRef.current;
  //   const ctx = canvas.getContext('2d');
    
  //   ctx.beginPath();
  //   ctx.moveTo(data.prevX, data.prevY);
  //   ctx.lineTo(data.currX, data.currY);
  //   ctx.strokeStyle = data.color;
  //   ctx.lineWidth = data.brushSize;
  //   ctx.stroke();
  //   ctx.closePath();
  // };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.stroke();

    // Send drawing data to server
    const drawData = {
      type:"draw",
      prevX: x - e.movementX,
      prevY: y - e.movementY,
      currX: x,
      currY: y,
      color: color,
      brushSize: brushSize,
      
    };
    

    wsRef.current.send(JSON.stringify(drawData));
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    wsRef.current.send(JSON.stringify({ type: 'clear' }));
  };

  // if (!user) {
  //   return <LoginScreen onLogin={(userName) => setUser({ id: Date.now().toString(), name: userName })} />;
  // }

   return (
    <div className="flex flex-col bg-zinc-900 text-white items-center p-4 gap-4">
    <div className="w-full max-w-3xl flex justify-between items-center mb-4">
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
          className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
        >
          Create New Room
        </button>
      </div>
      <div className="flex flex-col gap-4 mb-4 w-full max-w-3xl">
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
          
          <button
            onClick={clearCanvas}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear
          </button>
        </div>
      </div>
      
      <canvas
        ref={canvasRef}
        width={1500}
        height={600}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        className="border border-gray-300 rounded shadow-lg"
      />
    </div>
  );
};

export default Whiteboard;