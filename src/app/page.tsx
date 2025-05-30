'use client';

import {useState, useEffect} from 'react';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {useToast} from '@/hooks/use-toast';
import {Lock, LockOpen, UserPlus, Users} from 'lucide-react';
import {AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger} from '@/components/ui/alert-dialog';
import {Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow} from '@/components/ui/table';
import {cn} from '@/lib/utils';
import {getDatabase, ref, set, onValue, remove, child, update} from 'firebase/database';
import {initializeApp, FirebaseApp} from 'firebase/app';
import {getAnalytics} from 'firebase/analytics';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCWZr4Olz0Q2jL7RD-p3uFRggkGcoXmK3Y",
  authDomain: "weblock-f4fc1.firebaseapp.com",
  databaseURL: "https://weblock-f4fc1-default-rtdb.firebaseio.com",
  projectId: "weblock-f4fc1",
  storageBucket: "weblock-f4fc1.firebasestorage.app",
  messagingSenderId: "888306996203",
  appId: "1:888306996203:web:ae4a8a7608e125781abfae",
  measurementId: "G-SLR65WSY0R"
};

let app: FirebaseApp;
let db: any;

// Initialize Firebase
try {
  console.log('Initializing Firebase with config:', {
    apiKey: firebaseConfig.apiKey,
    databaseURL: firebaseConfig.databaseURL,
    projectId: firebaseConfig.projectId
  });
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  
  // Test database connection
  const testRef = ref(db, '.info/connected');
  onValue(testRef, (snapshot) => {
    const connected = snapshot.val();
    if (connected) {
      console.log('Connected to Firebase Realtime Database');
      
      // Check for initial data
      const rootRef = ref(db);
      onValue(
        rootRef, 
        (snapshot) => {
          console.log('Database structure:', snapshot.exists() ? 'Data exists' : 'No data');
          if (!snapshot.exists()) {
            console.log('Creating initial database structure');
            // Create initial structure if not exists
            const updates: {[key: string]: any} = {};
            updates['users'] = {};
            updates['logs'] = {};
            update(rootRef, updates)
              .then(() => console.log('Initial database structure created'))
              .catch(error => console.error('Error creating initial structure:', error));
          }
        }, 
        { onlyOnce: true }
      );
    } else {
      console.warn('Disconnected from Firebase Realtime Database');
      console.warn('Make sure your Firebase database rules allow read/write access:');
      console.warn(`
        Recommended rules for testing:
        {
          "rules": {
            ".read": true,
            ".write": true
          }
        }
      `);
    }
  });
  
  if (typeof window !== 'undefined') {
    getAnalytics(app);
  }
  console.log('Firebase initialized successfully!');
} catch (error: any) {
  console.error('Firebase initialization error:', error.message);
}

export default function Home() {
  const [isLocked, setIsLocked] = useState(true);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [rfid, setRfid] = useState('');
  const [users, setUsers] = useState<{[rfid: string]: string}>({});
  const {toast} = useToast();

  useEffect(() => {
    if (!db) {
      console.warn('Firebase not initialized. Check your environment variables and Firebase configuration.');
      return;
    }
    
    console.log('Initializing Firebase Realtime Database listeners');

    // Read users from Firebase Realtime Database
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setUsers(data);
      } else {
        setUsers({});
      }
    });

    // Read logs from Firebase Realtime Database
    const logsRef = ref(db, 'logs');
    onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convert the logs object to an array
        const logsArray = Object.values(data).sort((a: any, b: any) => b.timestamp - a.timestamp).map((log: any) => log.message);
        setLogMessages(logsArray);
      } else {
        setLogMessages([]);
      }
    });
  }, [db]);

  const writeLog = (message: string) => {
    if (!db) {
      console.warn('Firebase not initialized. Cannot write logs.');
      return;
    }

    const logsRef = ref(db, 'logs');
    const newLogRef = child(logsRef, new Date().getTime().toString()); // Use child to generate unique keys
    set(newLogRef, {
      message: message,
      timestamp: Date.now(),
    })
    .then(() => {
      console.log('Log written successfully:', message);
    })
    .catch((error) => {
      console.error('Error writing log to Firebase:', error);
    });
  };

  const toggleLock = () => {
    const newLockState = !isLocked;
    setIsLocked(newLockState);
    const message = newLockState ? 'Lock Engaged' : 'Lock Disengaged';
    writeLog(message);
    toast({
      title: message,
      description: `The lock is now ${newLockState ? 'locked' : 'unlocked'}.`,
    });
  };

  const handleRfidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (users[rfid]) {
      setIsLocked(false);
      const message = `Access Granted: RFID ${rfid} - ${users[rfid]}`;
      writeLog(message);
      toast({
        title: 'Access Granted',
        description: message,
      });
      // Simulate auto-lock after 5 seconds
      setTimeout(() => {
        setIsLocked(true);
        writeLog('Lock Re-engaged');
        toast({
          title: 'Lock Re-engaged',
          description: 'The lock has been automatically re-engaged.',
        });
      }, 5000);
    } else {
      const message = `Access Denied: Unknown RFID ${rfid}`;
      writeLog(message);
      toast({
        title: 'Access Denied',
        description: message,
        variant: 'destructive',
      });
    }
    setRfid('');
  };

  const handleAddUser = (name: string) => {
    if (rfid && name) {
      // Write user to Firebase Realtime Database
      const usersRef = ref(db, 'users');
      set(child(usersRef, rfid), name)
        .then(() => {
          console.log('User added successfully:', rfid, name);
          writeLog(`User Added: RFID ${rfid} - ${name}`);
          toast({
            title: 'User Added',
            description: `User ${name} added with RFID ${rfid}.`,
          });
          setRfid(''); // Clear RFID after adding user
        })
        .catch((error) => {
          console.error('Error adding user to Firebase:', error);
          toast({
            title: 'Error',
            description: `Failed to add user: ${error.message}`,
            variant: 'destructive',
          });
        });
    } else {
      toast({
        title: 'Error',
        description: 'RFID and Name cannot be empty.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = (rfidToDelete: string) => {
    // Remove user from Firebase Realtime Database
    const userRef = ref(db, `users/${rfidToDelete}`);
    remove(userRef)
      .then(() => {
        console.log('User deleted successfully:', rfidToDelete);
        writeLog(`User Deleted: RFID ${rfidToDelete}`);
        toast({
          title: 'User Deleted',
          description: `User with RFID ${rfidToDelete} has been deleted.`,
        });
      })
      .catch((error) => {
        console.error('Error deleting user from Firebase:', error);
        toast({
          title: 'Error',
          description: `Failed to delete user: ${error.message}`,
          variant: 'destructive',
        });
      });
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <Card className="w-full max-w-md space-y-4">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Lock className="mr-2 h-6 w-6" />
            SecureWebLock
          </CardTitle>
          <CardDescription>
            Electronic Lock Management System
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Lock Status and Control */}
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">
              Lock Status: {isLocked ? 'Locked' : 'Unlocked'}
            </div>
            <Button onClick={toggleLock} variant="outline">
              {isLocked ? <LockOpen className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
              {isLocked ? 'Unlock' : 'Lock'}
            </Button>
          </div>

          {/* RFID Input */}
          <form onSubmit={handleRfidSubmit} className="flex items-center space-x-2">
            <Input
              type="text"
              placeholder="Enter RFID"
              value={rfid}
              onChange={(e) => setRfid(e.target.value)}
            />
            <Button type="submit">Verify RFID</Button>
          </form>

          {/* Add User Interface */}
          <AddUserComponent rfid={rfid} setRfid={setRfid} onAddUser={handleAddUser} />

          {/* Users Table */}
          <UsersTable users={users} onDeleteUser={handleDeleteUser} />

          {/* Access Logs */}
          <div className="space-y-2">
            <h3 className="text-md font-semibold">Access Logs</h3>
            <div className="max-h-40 overflow-y-auto rounded-md border">
              {logMessages.map((log, index) => (
                <div
                  key={index}
                  className={cn(
                    'px-3 py-1 text-sm',
                    index % 2 === 0 ? 'bg-muted' : 'bg-secondary'
                  )}>
                  {log}
                </div>
              ))}
              {logMessages.length === 0 && (
                <div className="px-3 py-1 text-sm text-muted-foreground">
                  No logs yet.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AddUserComponent({rfid, setRfid, onAddUser}: {rfid: string; setRfid: (rfid: string) => void; onAddUser: (name: string) => void}) {
  const [name, setName] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAddUser(name);
        setName('');
      }}
      className="flex items-center space-x-2">
      <Input
        type="text"
        placeholder="New User Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        type="text"
        placeholder="Enter RFID to assign"
        value={rfid}
        onChange={(e) => setRfid(e.target.value)}
      />
      <Button type="submit" variant="secondary">
        <UserPlus className="mr-2 h-4 w-4" />
        Add User
      </Button>
    </form>
  );
}

function UsersTable({users, onDeleteUser}: {users: {[rfid: string]: string}; onDeleteUser: (rfid: string) => void}) {
  return (
    <div className="space-y-2">
      <h3 className="text-md font-semibold flex items-center">
        <Users className="mr-2 h-5 w-5" />
        Authorized Users
      </h3>
      <Table>
        <TableCaption>A list of authorized users and their associated RFID tags.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>RFID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(users).length > 0 ? (
            Object.entries(users).map(([rfid, name]) => (
              <TableRow key={rfid}>
                <TableCell>{rfid}</TableCell>
                <TableCell>{name}</TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the user with RFID:{' '}
                          {rfid} from our records.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDeleteUser(rfid)}>
                          Continue
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={3} className="text-center">
                No users added yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
