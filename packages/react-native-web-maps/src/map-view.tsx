import { ForwardedRef, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { GoogleMap } from '@react-google-maps/api'
import { Region, Camera } from 'react-native-maps'
import { useUpdateEffect } from 'react-use'
import { View } from 'react-native'

import { calcZoom, zoomReverseDelta } from './utils'
import { DEFAULT_OPTIONS, MAP_TYPE_MAPS, DEFAULT_REGION } from './config'
import { MapViewHandle, MapViewProps } from './types'

const MapView = forwardRef(function MapView ({
  region,
  initialRegion,
  style,
  zoomEnabled = true,
  zoomControlEnabled = true,
  zoomTapEnabled = true,
  minZoomLevel,
  maxZoomLevel,
  mapType = 'standard',
  customMapStyle,
  showsMyLocationButton = false,
  showsUserLocation = false,
  options: provideOptions,
  onMapReady,
  onRegionChange,
  onRegionChangeComplete,
  // onPress,
  // onDoublePress,
  // onPanDrag,
  ...props
}: MapViewProps, ref: ForwardedRef<MapViewHandle>) {
  const instance = useRef<google.maps.Map | null>(null)
  const locationButtonRef = useRef<HTMLButtonElement | null>(null)
  const userLocationMarker = useRef<google.maps.Marker | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const options: google.maps.MapOptions = useMemo(() => {
    return Object.assign(DEFAULT_OPTIONS, {
      gestureHandling: zoomEnabled ? 'auto' : 'none',
      zoomControl: zoomControlEnabled,
      disableDoubleClickZoom: !zoomTapEnabled,
      mapTypeId: MAP_TYPE_MAPS[mapType],
      styles: customMapStyle,
      minZoom: minZoomLevel,
      maxZoom: maxZoomLevel
    }, provideOptions)
  }, [zoomEnabled, zoomControlEnabled, zoomTapEnabled, mapType, customMapStyle, minZoomLevel, maxZoomLevel, provideOptions])
  const [center, setCenter] = useState<google.maps.LatLngLiteral>(() => ({
    lat: region?.latitude ?? initialRegion?.latitude ?? DEFAULT_REGION.latitude,
    lng: region?.longitude ?? initialRegion?.longitude ?? DEFAULT_REGION.longitude
  }))
  const [zoom, setZoom] = useState<number>(() => {
    return calcZoom(region?.longitudeDelta ?? initialRegion?.longitudeDelta ?? DEFAULT_REGION.longitudeDelta)
  })
  const deltaRadio = useMemo(() => {
    return (region?.latitudeDelta ?? initialRegion?.latitudeDelta ?? DEFAULT_REGION.latitudeDelta) /
    (region?.longitudeDelta ?? initialRegion?.longitudeDelta ?? DEFAULT_REGION.longitudeDelta)
  }, [region])

  useImperativeHandle(ref, () => ({
    getCamera () {
      const center = instance.current?.getCenter()!
      return {
        center: {
          latitude: center?.lat() ?? 0,
          longitude: center?.lng() ?? 0
        },
        pitch: instance.current?.getTilt() ?? 0,
        altitude: 0, // it will be ignored by Google Maps
        heading: instance.current?.getHeading() ?? 0,
        zoom: instance.current?.getZoom() ?? 0
      }
    },
    /**
     * different with react-native-maps, no animation
     * @param {Camera}
     */
    animateCamera ({ center, ...others }: Camera) {
      instance.current?.moveCamera({
        center: {
          lat: center.latitude,
          lng: center.longitude
        },
        ...others
      })
    },
    setCamera ({ center, ...others }: Camera) {
      instance.current?.moveCamera({
        center: {
          lat: center.latitude,
          lng: center.longitude
        },
        ...others
      })
    },
    animateToRegion (region: Region) {
      instance.current?.panTo({
        lat: region.latitude,
        lng: region.longitude
      })
    }
  }))

  useUpdateEffect(() => {
    setCenter({
      lat: region!.latitude,
      lng: region!.longitude
    })
    setZoom(calcZoom(region!.longitude))
  }, [region])

  // Cleanup user location marker on unmount
  useEffect(() => {
    return () => {
      if (userLocationMarker.current) {
        userLocationMarker.current.setMap(null)
        userLocationMarker.current = null
      }
    }
  }, [])

  // Handle user location updates
  useEffect(() => {
    if (!showsUserLocation || !navigator.geolocation) {
      // Clean up marker if showsUserLocation is false
      if (userLocationMarker.current) {
        userLocationMarker.current.setMap(null)
        userLocationMarker.current = null
      }
      return
    }

    // Wait for map to be loaded
    if (!mapLoaded || !instance.current) {
      return
    }

    const updateUserLocation = (position: GeolocationPosition) => {
      const pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      }

      if (!userLocationMarker.current && instance.current) {
        userLocationMarker.current = new google.maps.Marker({
          position: pos,
          map: instance.current,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2
          },
          title: 'Your location',
          zIndex: 1000,
          optimized: false
        })
      } else if (userLocationMarker.current) {
        userLocationMarker.current.setPosition(pos)
      }
    }

    const handleError = (error: GeolocationPositionError) => {
      // Silently handle geolocation errors
    }

    // Get initial position immediately
    navigator.geolocation.getCurrentPosition(updateUserLocation, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    })

    // Watch position for continuous updates
    const watchId = navigator.geolocation.watchPosition(updateUserLocation, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000
    })

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [showsUserLocation, mapLoaded])

  const onLoad = (map: google.maps.Map): void => {
    instance.current = map
    setMapLoaded(true)
    
    // Add current location button if enabled
    if (showsMyLocationButton) {
      const locationButton = document.createElement('button')
      locationButtonRef.current = locationButton
      
      locationButton.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" style="display: block;">
          <path fill="#666" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
        </svg>
      `
      locationButton.title = 'Go to current location'
      locationButton.type = 'button'
      locationButton.style.cssText = `
        background-color: #fff;
        border: none;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
        margin: 10px;
        padding: 10px;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        transform: scale(1);
        pointer-events: auto;
        position: relative;
        z-index: 1;
      `
      
      locationButton.addEventListener('mouseenter', () => {
        if (!locationButton.disabled) {
          locationButton.style.backgroundColor = '#f5f5f5'
          locationButton.style.transform = 'scale(1.1)'
          locationButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)'
        }
      })
      
      locationButton.addEventListener('mouseleave', () => {
        if (!locationButton.disabled) {
          locationButton.style.backgroundColor = '#fff'
          locationButton.style.transform = 'scale(1)'
          locationButton.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)'
        }
      })
      
      locationButton.addEventListener('mousedown', () => {
        if (!locationButton.disabled) {
          locationButton.style.transform = 'scale(0.95)'
        }
      })
      
      locationButton.addEventListener('mouseup', () => {
        if (!locationButton.disabled) {
          locationButton.style.transform = 'scale(1.1)'
        }
      })
      
      locationButton.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        
        if (locationButton.disabled) {
          return
        }
        
        // If user location marker exists, use its position
        if (userLocationMarker.current) {
          const pos = userLocationMarker.current.getPosition()
          if (pos) {
            map.panTo(pos)
            return
          }
        }
        
        // Otherwise, get fresh location
        if (!navigator.geolocation) {
          return
        }

        locationButton.disabled = true
        locationButton.style.cursor = 'wait'
        locationButton.style.opacity = '0.6'
        
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            }
            map.panTo(pos)
            
            locationButton.disabled = false
            locationButton.style.cursor = 'pointer'
            locationButton.style.opacity = '1'
          },
          () => {
            locationButton.disabled = false
            locationButton.style.cursor = 'pointer'
            locationButton.style.opacity = '1'
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000 // Allow cached position up to 1 minute old
          }
        )
      })
      
      map.controls[google.maps.ControlPosition.TOP_RIGHT].push(locationButton)
    }
    
    onMapReady?.()
  }

  const getCurrentRegion = (): Region => {
    const zoom = instance.current?.getZoom()
    const center = instance.current?.getCenter()
    const delta = zoom === null ? null : zoomReverseDelta(zoom!, deltaRadio)
    return {
      latitude: center?.lat() ?? 0,
      latitudeDelta: delta?.latitudeDelta ?? 0,
      longitude: center?.lng() ?? 0,
      longitudeDelta: delta?.longitudeDelta ?? 0
    }
  }

  const onChangeComplete = (): void => {
    const _region = getCurrentRegion()
    onRegionChange?.(_region, { isGesture: true })
    onRegionChangeComplete?.(_region, { isGesture: true })
  }

  const onZoomChanged = (): void => {
    // fix onZoomChanged be triggered before onLoad callback
    if (instance.current == null) return

    onChangeComplete()
  }

  // ignore onIdle event when Map ready
  const hasIdleTriggerd = useRef(false)

  const onIdle = (): void => {
    if (!hasIdleTriggerd.current) {
      hasIdleTriggerd.current = true
      return
    }
    onChangeComplete()
  }

  const onDrag = (): void => {
    const _region = getCurrentRegion()
    onRegionChange?.(_region, { isGesture: true })
    // onPanDrag?.({
    //   // nativeEvent not support position
    //   nativeEvent: {
    //     coordinate: {
    //       latitude: _region.latitude,
    //       longitude: _region.longitude
    //     }
    //   }
    // })
  }

  const onClick = (e: google.maps.MapMouseEvent): void => {
    // onPress?.({
    //   // nativeEvent not support position
    //   nativeEvent: {
    //     action: 'press',
    //     coordinate: {
    //       latitude: e.latLng!.lat(),
    //       longitude: e.latLng!.lng()
    //     }
    //   }
    // })
  }

  const onDblClick = (e: google.maps.MapMouseEvent): void => {
    // onDoublePress?.({
    //   // nativeEvent not support position
    //   nativeEvent: {
    //     action: 'press',
    //     coordinate: {
    //       latitude: e.latLng!.lat(),
    //       longitude: e.latLng!.lng()
    //     }
    //   }
    // })
  }

  return (
    <View style={style}>
      <GoogleMap
        mapContainerStyle={{ height: '100%' }}
        center={center}
        zoom={zoom}
        options={options}
        onLoad={onLoad}
        onZoomChanged={onZoomChanged}
        onDrag={onDrag}
        onClick={onClick}
        onDblClick={onDblClick}
        onIdle={onIdle}
        {...props}
      />
    </View>
  )
})

export default MapView
