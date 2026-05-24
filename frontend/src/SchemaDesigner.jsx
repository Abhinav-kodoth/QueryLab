import { useState, useCallback } from 'react'
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Handle,      
  Position,    
} from 'reactflow'
import 'reactflow/dist/style.css'

function TableNode({ data, selected }) {
  return (
    <div style={{
      background: 'white',
      border: selected ? '2px solid #2563eb' : '1px solid #e2e8f0',
      borderRadius: '8px',
      minWidth: '200px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#2563eb',
          width: '10px',
          height: '10px',
          border: '2px solid white'
        }}
      />

      {}
      <div style={{
        background: '#1e293b',
        color: 'white',
        padding: '8px 12px',
        fontSize: '13px',
        fontWeight: '600',
        fontFamily: 'monospace'
      }}>
        {data.tableName}
      </div>

      {}
      <div style={{ padding: '8px 0' }}>
        {data.columns.map((col, i) => (
          <div key={i} style={{
            padding: '4px 12px',
            fontSize: '12px',
            fontFamily: 'monospace',
            display: 'flex',
            justifyContent: 'space-between',
            borderBottom: i < data.columns.length - 1 ? '1px solid #f1f5f9' : 'none'
          }}>
            <span style={{ color: col.isPrimary ? '#d97706' : '#374151' }}>
              {col.isPrimary ? '🔑 ' : ''}{col.name}
            </span>
            <span style={{ color: '#94a3b8' }}>{col.type}</span>
          </div>
        ))}
      </div>

      {}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#2563eb',
          width: '10px',
          height: '10px',
          border: '2px solid white'
        }}
      />
    </div>
  )
}

const nodeTypes = { table: TableNode }

const COLUMN_TYPES = ['SERIAL', 'INTEGER', 'TEXT', 'VARCHAR(255)', 'NUMERIC', 'BOOLEAN', 'TIMESTAMP', 'DATE', 'UUID']

export default function SchemaDesigner() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState(null)
  const [issues, setIssues] = useState([])
  const [generatedSQL, setGeneratedSQL] = useState('')
  const [tableCount, setTableCount] = useState(0)

  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge({
      ...params,
      label: 'FK',
      style: { stroke: '#2563eb' },
      labelStyle: { fontSize: '10px', fill: '#2563eb' }
    }, eds))
  }, [setEdges])

  function addTable() {
    const id = `table-${tableCount}`
    const newNode = {
      id,
      type: 'table',
      position: { x: 100 + (tableCount % 4) * 250, y: 100 + Math.floor(tableCount / 4) * 200 },
      data: {
        tableName: `table_${tableCount + 1}`,
        columns: [
          { name: 'id', type: 'SERIAL', isPrimary: true }
        ]
      }
    }
    setNodes((nds) => [...nds, newNode])
    setTableCount((c) => c + 1)
    setSelectedNode(newNode)
  }

  function updateSelectedNode(field, value) {
    if (!selectedNode) return
    setNodes((nds) => nds.map((n) => {
      if (n.id !== selectedNode.id) return n
      const updated = { ...n, data: { ...n.data, [field]: value } }
      setSelectedNode(updated)
      return updated
    }))
  }

  function addColumn() {
    if (!selectedNode) return
    setNodes((nds) => nds.map((n) => {
      if (n.id !== selectedNode.id) return n
      const updated = {
        ...n,
        data: {
          ...n.data,
          columns: [...n.data.columns, { name: 'column', type: 'TEXT', isPrimary: false }]
        }
      }
      setSelectedNode(updated)
      return updated
    }))
  }

  function updateColumn(colIndex, field, value) {
    if (!selectedNode) return
    setNodes((nds) => nds.map((n) => {
      if (n.id !== selectedNode.id) return n
      const updatedColumns = n.data.columns.map((col, i) => {
        if (i !== colIndex) return col
        return { ...col, [field]: value }
      })
      const updated = { ...n, data: { ...n.data, columns: updatedColumns } }
      setSelectedNode(updated)
      return updated
    }))
  }

  function removeColumn(colIndex) {
    if (!selectedNode) return
    setNodes((nds) => nds.map((n) => {
      if (n.id !== selectedNode.id) return n
      const updated = {
        ...n,
        data: {
          ...n.data,
          columns: n.data.columns.filter((_, i) => i !== colIndex)
        }
      }
      setSelectedNode(updated)
      return updated
    }))
  }

  function deleteSelectedTable() {
    if (!selectedNode) return
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id))
    setEdges((eds) => eds.filter(
      (e) => e.source !== selectedNode.id && e.target !== selectedNode.id
    ))
    setSelectedNode(null)
  }

 
  function checkSchemaIssues() {
    const found = []

    nodes.forEach((node) => {
      const { tableName, columns } = node.data

      // Real structural check — duplicate column names are always wrong
      const names = columns.map((c) => c.name)
      const duplicates = names.filter((name, i) => names.indexOf(name) !== i)
      if (duplicates.length > 0) {
        found.push(`Structural issue in "${tableName}": duplicate column names — ${[...new Set(duplicates)].join(', ')}`)
      }

      
      const hasPrimary = columns.some((c) => c.isPrimary)
      if (!hasPrimary) {
        found.push(`Structural issue in "${tableName}": no primary key defined — every table needs a way to uniquely identify each row`)
      }

      // Design heuristic — generic column names suggest unclear design
      
      const genericNames = ['data', 'info', 'value', 'misc', 'other', 'extra']
      columns.forEach((col) => {
        if (!col.isPrimary && genericNames.includes(col.name.toLowerCase())) {
          found.push(`Design warning in "${tableName}": column "${col.name}" has a generic name — unclear what it represents. Give it a more specific name that describes its purpose.`)
        }
      })

      const transitivePatterns = [
        {
          cols: ['city', 'zip_code'],
          msg: 'city and zip_code — zip_code determines city, meaning city does not directly depend on the primary key. Move to a separate ZipCodes table.'
        },
        {
          cols: ['city', 'zipcode'],
          msg: 'city and zipcode — zipcode determines city. Move to a separate ZipCodes table.'
        },
        {
          cols: ['category_name', 'category_id'],
          msg: 'category_name depends on category_id, not the primary key. Move to a separate Categories table.'
        },
        {
          cols: ['department', 'department_id'],
          msg: 'department depends on department_id, not the primary key. Move to a separate Departments table.'
        },
        {
          cols: ['country', 'country_code'],
          msg: 'country depends on country_code. Move to a separate Countries table.'
        },
      ]

      const colNames = columns.map((c) => c.name.toLowerCase())
      transitivePatterns.forEach(({ cols, msg }) => {
        if (cols.every((c) => colNames.includes(c))) {
          found.push(`Transitive dependency in "${tableName}": ${msg}`)
        }
      })

      
      const derivedNames = ['total_price', 'full_name', 'total_amount', 'age']
      columns.forEach((col) => {
        if (derivedNames.includes(col.name.toLowerCase())) {
          found.push(`Derived value warning in "${tableName}": "${col.name}" looks like a calculated value that depends on other columns. Consider computing it in your queries instead of storing it — stored derived values can become inconsistent.`)
        }
      })
    })

    setIssues(found)
  }

  function generateSQL() {
    if (nodes.length === 0) {
      setGeneratedSQL('-- No tables to export')
      return
    }

   
    const foreignKeys = {}
    edges.forEach((edge) => {
      if (!foreignKeys[edge.source]) foreignKeys[edge.source] = []
      const targetNode = nodes.find((n) => n.id === edge.target)
      if (targetNode) {
        foreignKeys[edge.source].push(targetNode.data.tableName)
      }
    })

    const sql = nodes.map((node) => {
      const { tableName, columns } = node.data

      const columnDefs = columns.map((col) => {
        let def = `  ${col.name} ${col.type}`
        if (col.isPrimary) def += ' PRIMARY KEY'
        return def
      })

      const fks = (foreignKeys[node.id] || []).map((refTable) => {
        return `  FOREIGN KEY (${refTable}_id) REFERENCES ${refTable}(id)`
      })

      const allDefs = [...columnDefs, ...fks].join(',\n')
      return `CREATE TABLE ${tableName} (\n${allDefs}\n);`
    }).join('\n\n')

    setGeneratedSQL(sql)
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '0.5rem' }}>Schema Designer</h2>
      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '1.5rem' }}>
        Design your database schema visually. Draw relationships between tables.
        Check for structural issues and common design problems.
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button onClick={addTable} style={btnStyle('#2563eb')}>+ Add Table</button>
        <button onClick={checkSchemaIssues} style={btnStyle('#7c3aed')}>Check Schema Issues</button>
        <button onClick={generateSQL} style={btnStyle('#059669')}>Export SQL</button>
        {selectedNode && (
          <button onClick={deleteSelectedTable} style={btnStyle('#dc2626')}>Delete Table</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', height: '500px' }}>

        <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNode(node)}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        {selectedNode && (
          <div style={{
            width: '280px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1rem',
            overflowY: 'auto',
            background: 'white'
          }}>
            <h4 style={{ marginBottom: '0.75rem' }}>Edit Table</h4>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                TABLE NAME
              </label>
              <input
                value={selectedNode.data.tableName}
                onChange={(e) => updateSelectedNode('tableName', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                COLUMNS
              </label>
              {selectedNode.data.columns.map((col, i) => (
                <div key={i} style={{
                  display: 'flex',
                  gap: '4px',
                  marginBottom: '6px',
                  alignItems: 'center'
                }}>
                  <input
                    value={col.name}
                    onChange={(e) => updateColumn(i, 'name', e.target.value)}
                    style={{ ...inputStyle, flex: 1, fontSize: '11px' }}
                    placeholder="column name"
                  />
                  <select
                    value={col.type}
                    onChange={(e) => updateColumn(i, 'type', e.target.value)}
                    style={{ ...inputStyle, fontSize: '11px', width: '110px' }}
                  >
                    {COLUMN_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => updateColumn(i, 'isPrimary', !col.isPrimary)}
                    title="Toggle primary key — user must explicitly mark this"
                    style={{
                      background: col.isPrimary ? '#d97706' : '#f1f5f9',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    🔑
                  </button>
                  {selectedNode.data.columns.length > 1 && (
                    <button
                      onClick={() => removeColumn(i)}
                      style={{
                        background: '#fee2e2',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: '#b91c1c'
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              <button
                onClick={addColumn}
                style={{ fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
              >
                + Add Column
              </button>
            </div>

            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1rem' }}>
              Drag from table edge to another table to create a foreign key relationship.
              Primary key must be marked manually using the 🔑 button.
            </p>
          </div>
        )}
      </div>

      {/* Schema issues panel */}
      {issues.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>Schema Issues Detected</h3>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '0.75rem' }}>
            Structural issues are definite problems. Design warnings are common patterns worth reviewing.
          </p>
          {issues.map((v, i) => (
            <div key={i} style={{
              background: v.startsWith('Structural') ? '#fef2f2' : '#fff7ed',
              border: v.startsWith('Structural') ? '1px solid #fca5a5' : '1px solid #fed7aa',
              borderRadius: '6px',
              padding: '10px 14px',
              marginBottom: '8px',
              fontSize: '13px',
              color: v.startsWith('Structural') ? '#b91c1c' : '#9a3412'
            }}>
              {v.startsWith('Structural') ? '🔴' : '⚠️'} {v}
            </div>
          ))}
        </div>
      )}

      {issues.length === 0 && nodes.length > 0 && (
        <div style={{
          marginTop: '1.5rem',
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '6px',
          padding: '10px 14px',
          fontSize: '13px',
          color: '#166534'
        }}>
          ✅ No schema issues detected. Schema looks clean.
        </div>
      )}

      {/* Generated SQL */}
      {generatedSQL && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>Generated SQL</h3>
          <pre style={{
            background: '#1e293b',
            color: '#86efac',
            padding: '1rem',
            borderRadius: '8px',
            fontSize: '12px',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap'
          }}>
            {generatedSQL}
          </pre>
          <button
            onClick={() => navigator.clipboard.writeText(generatedSQL)}
            style={{ ...btnStyle('#475569'), marginTop: '8px', fontSize: '12px' }}
          >
            Copy SQL
          </button>
        </div>
      )}
    </div>
  )
}

function btnStyle(bg) {
  return {
    padding: '8px 16px',
    background: bg,
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'monospace'
  }
}

const inputStyle = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #e2e8f0',
  borderRadius: '4px',
  fontSize: '12px',
  fontFamily: 'monospace',
  outline: 'none'
}