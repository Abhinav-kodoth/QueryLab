import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

// Recursively convert Postgres plan JSON to D3 hierarchy format
function convertToD3(node) {
  return {
    name: node['Node Type'],
    cost: node['Total Cost'],
    actualTime: node['Actual Total Time'] || 0,
    rows: node['Actual Rows'] || 0,
    children: node['Plans'] ? node['Plans'].map(convertToD3) : []
  }
}

// Color based on how expensive this node is relative to total
function getNodeColor(actualTime, maxTime) {
  if (maxTime === 0) return '#22c55e'
  const ratio = actualTime / maxTime
  if (ratio > 0.7) return '#ef4444' // red — slow
  if (ratio > 0.3) return '#f59e0b' // amber — medium
  return '#22c55e'                   // green — fast
}

// Find the max actual time in the whole tree
function getMaxTime(node) {
  const children = node.children || []
  return Math.max(node.actualTime, ...children.map(getMaxTime))
}

export default function PlanVisualizer({ plan }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!plan || !svgRef.current) return

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove()

    const data = convertToD3(plan['Plan'])
    const maxTime = getMaxTime(data)

    const width = 800
    const height = 400
    const margin = { top: 40, right: 40, bottom: 40, left: 40 }

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Build the tree layout
    const root = d3.hierarchy(data)
    const treeLayout = d3.tree()
      .size([width - margin.left - margin.right, height - margin.top - margin.bottom])

    treeLayout(root)

    // Draw links between nodes
    g.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', 2)
      .attr('d', d3.linkVertical()
        .x(d => d.x)
        .y(d => d.y)
      )

    // Draw nodes
    const node = g.selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x},${d.y})`)

    // Node circle
    node.append('circle')
      .attr('r', 28)
      .attr('fill', d => getNodeColor(d.data.actualTime, maxTime))
      .attr('stroke', 'white')
      .attr('stroke-width', 2)

    // Node label — operation name
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.3em')
      .attr('fill', 'white')
      .attr('font-size', '9px')
      .attr('font-weight', 'bold')
      .text(d => d.data.name.replace(' Scan', '').replace(' Join', ' Join'))

    // Node time
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1em')
      .attr('fill', 'white')
      .attr('font-size', '8px')
      .text(d => d.data.actualTime ? `${d.data.actualTime.toFixed(2)}ms` : '')

  }, [plan])

  return (
    <div>
      <h3 style={{ marginBottom: '0.5rem' }}>Query Plan Visualizer</h3>
      <div style={{ background: '#0f172a', borderRadius: '8px', padding: '1rem', overflowX: 'auto' }}>
        <svg ref={svgRef}></svg>
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '12px' }}>
        <span>🟢 Fast</span>
        <span>🟡 Medium</span>
        <span>🔴 Slow — consider an index</span>
      </div>
    </div>
  )
}