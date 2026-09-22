import React from 'react';
import { Search, Monitor, Cpu, HardDrive, Volume2, Settings2, ShieldCheck, Box } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="flex h-screen bg-black text-white w-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-800 flex flex-col">
        <div className="p-4">
          <h2 className="text-xl font-semibold mb-4">Settings</h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search settings..." 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-gray-600"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 mb-6">
            <h3 className="text-xs font-semibold text-gray-500 mb-2 px-3 uppercase tracking-wider">General</h3>
            <button className="w-full text-left px-3 py-2 text-sm text-white bg-zinc-800 rounded-md flex items-center">
              <Monitor className="h-4 w-4 mr-3" /> Appearance
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-white flex items-center">
              <Box className="h-4 w-4 mr-3" /> About & Updates
            </button>
          </div>

          <div className="px-3 mb-6">
            <h3 className="text-xs font-semibold text-gray-500 mb-2 px-3 uppercase tracking-wider">AI & Models</h3>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-white flex items-center">
              <Cpu className="h-4 w-4 mr-3" /> Providers
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-white flex items-center">
              <HardDrive className="h-4 w-4 mr-3" /> Offline Models
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-white flex items-center">
              <ShieldCheck className="h-4 w-4 mr-3" /> Documents Index
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-10 bg-black">
        <div className="max-w-4xl">
          <h1 className="text-2xl font-semibold mb-1">Appearance</h1>
          <p className="text-gray-400 text-sm mb-8">Choose how the application looks on this device.</p>

          <div className="grid grid-cols-3 gap-4 mb-10">
            {/* Theme Cards */}
            <div className="border-2 border-white rounded-xl p-4 bg-zinc-950 cursor-pointer">
              <div className="h-20 bg-zinc-900 rounded-md mb-4 flex items-center justify-center">
                <div className="w-8 h-1 bg-zinc-600 rounded-full"></div>
              </div>
              <h3 className="font-medium text-sm">Dark Theme</h3>
              <p className="text-xs text-gray-500">Default</p>
            </div>

            <div className="border border-zinc-800 rounded-xl p-4 bg-white text-black cursor-pointer opacity-80 hover:opacity-100">
              <div className="h-20 bg-gray-100 rounded-md mb-4 flex items-center justify-center">
                <div className="w-8 h-1 bg-gray-300 rounded-full"></div>
              </div>
              <h3 className="font-medium text-sm">Light Theme</h3>
              <p className="text-xs text-gray-500">Clean and bright</p>
            </div>

            <div className="border border-zinc-800 rounded-xl p-4 bg-pink-50 cursor-pointer opacity-80 hover:opacity-100">
              <div className="h-20 bg-pink-100 rounded-md mb-4 flex items-center justify-center">
                <div className="w-8 h-1 bg-pink-500 rounded-full"></div>
              </div>
              <h3 className="font-medium text-sm text-black">Baby Pink</h3>
              <p className="text-xs text-pink-500">Soft and warm</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-sm font-medium mb-4">Accent Color</h3>
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-white border-2 border-blue-500 ring-2 ring-white ring-offset-2 ring-offset-black cursor-pointer"></div>
              <div className="w-6 h-6 rounded-full bg-blue-500 cursor-pointer"></div>
              <div className="w-6 h-6 rounded-full bg-teal-400 cursor-pointer"></div>
              <div className="w-6 h-6 rounded-full bg-purple-500 cursor-pointer"></div>
              <div className="w-6 h-6 rounded-full bg-yellow-500 cursor-pointer"></div>
              <div className="w-6 h-6 rounded-full bg-red-500 cursor-pointer"></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-8">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium">UI Scale</label>
              </div>
              <div className="relative pt-2">
                <div className="h-1 w-full bg-zinc-800 rounded-full">
                  <div className="h-1 w-1/2 bg-white rounded-full"></div>
                </div>
                <div className="absolute top-1 left-1/2 w-3 h-3 bg-white rounded-full -ml-1.5 shadow"></div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>Compact</span>
                  <span>Default</span>
                  <span>Large</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Typography</label>
              <select className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none">
                <option>Monospace</option>
                <option>Inter</option>
                <option>System Default</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Interface Roundness</label>
              <select className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none">
                <option>Default</option>
                <option>Sharp</option>
                <option>Rounded</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">App Opacity</label>
              <select className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 px-3 text-sm focus:outline-none">
                <option>Transparent</option>
                <option>Opaque</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
