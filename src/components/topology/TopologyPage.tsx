/**
 * Topology Page Component
 *
 * Full page view for the Topology visualization
 */

import React, { useState, useEffect } from 'react';
import { useSessionTreeStore } from '../../store/sessionTreeStore';
import { TopologyView } from './TopologyView';
import { buildTopologyTree } from '../../lib/topologyUtils';
import type { TopologyNode } from '../../lib/topologyUtils';

export const TopologyPage: React.FC = () => {
    const [tree, setTree] = useState<TopologyNode[]>([]);
    const { rawNodes } = useSessionTreeStore();

    useEffect(() => {
        // Build topology tree from connected nodes
        // Filter primarily for visualization relevance if needed, 
        // but showing all nodes might be useful for a "Matrix" view
        // The original dialog filtered for connected/connecting.
        // We will stick to that to avoid cluttering the matrix with offline nodes
        // unless the user wants to see everything.
        
        const connectedNodes = rawNodes.filter(
            node => node.state.status === 'connected' || node.state.status === 'connecting'
        );

        const topologyTree = buildTopologyTree(connectedNodes);
        setTree(topologyTree);
    }, [rawNodes]);

    return (
        <div className="h-full w-full bg-theme-bg overflow-hidden flex flex-col">
            <div className="p-6 border-b border-theme-border bg-theme-bg-panel/50">
                <h1 className="text-2xl font-bold text-zinc-100 mb-2">Connection Matrix</h1>
                <p className="text-zinc-500 text-sm">Visual topology of active SSH tunnels and jump hosts.</p>
            </div>
            <div className="flex-1 overflow-hidden relative">
                {tree.length > 0 ? (
                    <TopologyView nodes={tree} />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                        <div className="text-lg">No active connections</div>
                        <p className="text-sm mt-2 opacity-70">Connect to servers to populate the matrix.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
