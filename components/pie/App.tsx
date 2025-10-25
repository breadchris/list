import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { PieMenu } from './components/PieMenu';
import { menuConfigs } from './components/PieMenuDemo';
import { CardPieMenuDemo } from './components/CardPieMenuDemo';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Separator } from './components/ui/separator';
import exampleImage from 'figma:asset/08b2eda01b175908ec3f7d6920076d2407ef6e67.png';

export default function App() {
  const [pieMenuState, setPieMenuState] = useState({
    isOpen: false,
    position: { x: 0, y: 0 },
    menuType: 'Design Tools' as keyof typeof menuConfigs
  });
  
  const [selectedMenu, setSelectedMenu] = useState<keyof typeof menuConfigs>('Design Tools');
  const [lastTriggeredMenu, setLastTriggeredMenu] = useState<string>('');
  const playgroundRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent, menuType: keyof typeof menuConfigs) => {
    e.preventDefault();
    const rect = playgroundRef.current?.getBoundingClientRect();
    if (rect) {
      setPieMenuState({
        isOpen: true,
        position: {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        },
        menuType
      });
      setLastTriggeredMenu(menuType);
    }
  };

  const handleClick = (e: React.MouseEvent, menuType: keyof typeof menuConfigs) => {
    const rect = playgroundRef.current?.getBoundingClientRect();
    if (rect) {
      setPieMenuState({
        isOpen: true,
        position: {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        },
        menuType
      });
      setLastTriggeredMenu(menuType);
    }
  };

  const closePieMenu = () => {
    setPieMenuState(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <motion.div 
          className="text-center space-y-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl text-white mb-2">Pie Action Menu Playground</h1>
          <p className="text-xl text-blue-200 mb-4">
            Streamline your workflow with customizable radial menus
          </p>
          <img 
            src={exampleImage} 
            alt="Pie Menu Example" 
            className="mx-auto rounded-lg shadow-2xl max-w-2xl w-full"
          />
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Menu Configuration</CardTitle>
              <CardDescription className="text-blue-200">
                Select a menu type and try it in the playground below
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <label className="text-white">Menu Type:</label>
                  <Select value={selectedMenu} onValueChange={setSelectedMenu}>
                    <SelectTrigger className="w-48 bg-white/10 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(menuConfigs).map((menuType) => (
                        <SelectItem key={menuType} value={menuType}>
                          {menuType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-200">
                  {menuConfigs[selectedMenu].length} actions
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-blue-200">Available Actions:</p>
                  <div className="flex flex-wrap gap-1">
                    {menuConfigs[selectedMenu].map((item) => (
                      <Badge key={item.id} variant="outline" className="border-blue-300/50 text-blue-200">
                        {item.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-blue-200">How to use:</p>
                  <ul className="text-sm text-blue-200 space-y-1">
                    <li>• Right-click any demo area to open menu</li>
                    <li>• Left-click demo buttons for quick access</li>
                    <li>• Hover over items to see labels</li>
                    <li>• Press Escape or click outside to close</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Demo Areas */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {Object.entries(menuConfigs).map(([menuType, items]) => (
            <Card 
              key={menuType}
              className="bg-white/10 backdrop-blur-md border-white/20 cursor-pointer transition-all hover:bg-white/15"
              onContextMenu={(e) => handleContextMenu(e, menuType as keyof typeof menuConfigs)}
            >
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  {menuType}
                  <Badge className="bg-blue-500 text-white">
                    {items.length}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-blue-200">
                  {menuType === 'Design Tools' && 'Creative tools and drawing utilities'}
                  {menuType === 'Productivity' && 'Workflow and organization tools'}
                  {menuType === 'Context Actions' && 'File and content management'}
                  {menuType === 'Social Actions' && 'Social media interactions'}
                  {menuType === 'Quick Actions' && 'Fast access productivity tools'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-blue-200">Right-click this area to open the pie menu</p>
                  <Separator className="bg-white/20" />
                  <Button 
                    variant="outline" 
                    className="w-full bg-transparent border-blue-300/50 text-blue-200 hover:bg-blue-500/20"
                    onClick={(e) => handleClick(e, menuType as keyof typeof menuConfigs)}
                  >
                    Open {menuType} Menu
                  </Button>
                  {lastTriggeredMenu === menuType && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-xs text-green-300 text-center"
                    >
                      ✓ Last opened menu
                    </motion.div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Card-Based Pie Menu Demo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <Card className="bg-white/5 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Card Selection Example</CardTitle>
              <CardDescription className="text-blue-200">
                Click any card to open a pie menu centered on that card
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CardPieMenuDemo />
            </CardContent>
          </Card>
        </motion.div>

        {/* Large Playground Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <Card className="bg-white/5 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Interactive Playground</CardTitle>
              <CardDescription className="text-blue-200">
                Right-click anywhere in this area to test the selected menu: {selectedMenu}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                ref={playgroundRef}
                className="relative h-96 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg border-2 border-dashed border-white/30 flex items-center justify-center cursor-crosshair"
                onContextMenu={(e) => handleContextMenu(e, selectedMenu)}
              >
                <div className="text-center space-y-2">
                  <p className="text-white text-lg">Right-click to activate pie menu</p>
                  <p className="text-blue-200 text-sm">
                    Current menu: {selectedMenu} ({menuConfigs[selectedMenu].length} actions)
                  </p>
                </div>
                
                {/* Pie Menu */}
                <PieMenu
                  items={menuConfigs[pieMenuState.menuType]}
                  isOpen={pieMenuState.isOpen}
                  position={pieMenuState.position}
                  onClose={closePieMenu}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer */}
        <motion.div
          className="text-center text-blue-300 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.0 }}
        >
          <p>Try different menu configurations and experience the power of radial navigation</p>
        </motion.div>
      </div>
    </div>
  );
}