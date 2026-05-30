import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://98.70.98.138/api'

const api = axios.create({
  baseURL: BASE_URL
})

export default api