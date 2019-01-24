/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { useState, EffectCallback } from "react"
import React from "react"

import { fetchConfig, fetchLogs, fetchStatus, fetchGraph } from "../api"
import {
  FetchConfigResponse,
  FetchStatusResponse,
  FetchGraphResponse,
  FetchLogResponse,
} from "../api/types"

interface StoreSlice {
  error: Error | null
  loading: boolean
}

interface Config extends StoreSlice { data: FetchConfigResponse | null }
interface Status extends StoreSlice { data: FetchStatusResponse | null }
interface Graph extends StoreSlice { data: FetchGraphResponse | null }
interface Logs extends StoreSlice { data: FetchLogResponse | null }

// This is the global data store
interface Store {
  config: Config
  status: Status
  graph: Graph
  logs: Logs,
}

interface Actions {
  loadLogs: EffectCallback
  loadConfig: EffectCallback
  loadStatus: EffectCallback
  loadGraph: EffectCallback
}

type KeyActionPair =
  ["config", () => Promise<FetchConfigResponse>] |
  ["logs", () => Promise<FetchLogResponse>] |
  ["status", () => Promise<FetchStatusResponse>] |
  ["graph", () => Promise<FetchGraphResponse>]

type Context = {
  store: Store,
  actions: Actions,
}

type SliceName = keyof Store
const sliceNames: SliceName[] = ["config", "status", "graph", "logs"]

// TODO Fix type cast
const initialState: Store = sliceNames.reduce((acc, key) => {
  const state = { data: null, loading: false, error: null }
  acc[key] = state
  return acc
}, {}) as Store

export const DataContext = React.createContext<Context | null>(null)

// Updates slices of the store based on the slice key
function updateSlice(prevState: Store, key: SliceName, sliceState: Object): Store {
  const prevSliceState = prevState[key]
  return {
    ...prevState,
    [key]: {
      ...prevSliceState,
      ...sliceState,
    },
  }
}

// Creates the actions needed for fetching data from the API and updates the store state as the actions are called.
function useApi() {
  const [store, setData] = useState<Store>(initialState)

  const fetch = async ([key, fetchFn]: KeyActionPair) => {
    setData(prevState => updateSlice(prevState, key, { loading: true }))

    try {
      const res = await fetchFn()
      setData(prevState => updateSlice(prevState, key, { data: res, error: null }))
    } catch (error) {
      setData(prevState => updateSlice(prevState, key, { error }))
    }

    setData(prevState => updateSlice(prevState, key, { loading: false }))
  }

  const fetchOrReadFromStore = (keyActionPair: KeyActionPair, force: boolean) => {
    const key = keyActionPair[0]
    const { data, loading } = store[key]
    if (!force && (data || loading)) {
      return
    }
    fetch(keyActionPair).catch(error => setData(prevState => updateSlice(prevState, key, { error })))
  }

  const loadLogs = (force: boolean = false) => fetchOrReadFromStore(["logs", fetchLogs], force)
  const loadConfig = (force: boolean = false) => fetchOrReadFromStore(["config", fetchConfig], force)
  const loadGraph = (force: boolean = false) => fetchOrReadFromStore(["graph", fetchGraph], force)
  const loadStatus = (force: boolean = false) => fetchOrReadFromStore(["status", fetchStatus], force)

  return {
    store,
    actions: {
      loadConfig,
      loadLogs,
      loadGraph,
      loadStatus,
    },
  }
}

/**
 * This component manages the "rest" API data state (not the websockets) for the entire application.
 * We use the new React Hooks API to pass store data and actions down the component tree.
 */
export const DataProvider: React.SFC = ({ children }) => {
  const storeAndActions = useApi()

  return (
    <DataContext.Provider value={storeAndActions}>
      {children}
    </DataContext.Provider>
  )
}
