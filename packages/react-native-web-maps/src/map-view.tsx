import {
  ForwardedRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react';
import { GoogleMap } from '@react-google-maps/api';
import { Region, Camera } from 'react-native-maps';
import { useUpdateEffect } from 'react-use';
import { View } from 'react-native';

import { calcZoom, zoomReverseDelta } from './utils';
import { DEFAULT_OPTIONS, MAP_TYPE_MAPS, DEFAULT_REGION } from './config';
import { MapViewHandle, MapViewProps } from './types';

const MapView = forwardRef(function MapView(
  {
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
    options: provideOptions,
    onMapReady,
    onRegionChange,
    onRegionChangeComplete,
    ...props
  }: MapViewProps,
  ref: ForwardedRef<MapViewHandle>
) {
  const instance = useRef<google.maps.Map | null>(null);

  const options: google.maps.MapOptions = useMemo(
    () => ({
      ...DEFAULT_OPTIONS,
      gestureHandling: zoomEnabled ? 'auto' : 'none',
      zoomControl: zoomControlEnabled,
      disableDoubleClickZoom: !zoomTapEnabled,
      mapTypeId: MAP_TYPE_MAPS[mapType],
      styles: customMapStyle,
      minZoom: minZoomLevel,
      maxZoom: maxZoomLevel,
      ...provideOptions
    }),
    [
      zoomEnabled,
      zoomControlEnabled,
      zoomTapEnabled,
      mapType,
      customMapStyle,
      minZoomLevel,
      maxZoomLevel,
      provideOptions
    ]
  );

  const [center, setCenter] = useState<google.maps.LatLngLiteral>(() => ({
    lat: region?.latitude ?? initialRegion?.latitude ?? DEFAULT_REGION.latitude,
    lng: region?.longitude ?? initialRegion?.longitude ?? DEFAULT_REGION.longitude
  }));

  const [zoom, setZoom] = useState<number>(() =>
    calcZoom(
      region?.longitudeDelta ??
        initialRegion?.longitudeDelta ??
        DEFAULT_REGION.longitudeDelta
    )
  );

  const deltaRatio = useMemo(() => {
    return (
      (region?.latitudeDelta ??
        initialRegion?.latitudeDelta ??
        DEFAULT_REGION.latitudeDelta) /
      (region?.longitudeDelta ??
        initialRegion?.longitudeDelta ??
        DEFAULT_REGION.longitudeDelta)
    );
  }, [region, initialRegion]);

  // Expose imperative methods
  useImperativeHandle(ref, () => ({
    getCamera() {
      const center = instance.current?.getCenter()!;
      return {
        center: {
          latitude: center?.lat() ?? 0,
          longitude: center?.lng() ?? 0
        },
        pitch: instance.current?.getTilt() ?? 0,
        altitude: 0,
        heading: instance.current?.getHeading() ?? 0,
        zoom: instance.current?.getZoom() ?? 0
      };
    },
    animateCamera({ center, ...others }: Camera) {
      instance.current?.moveCamera({
        center: { lat: center.latitude, lng: center.longitude },
        ...others
      });
    },
    setCamera({ center, ...others }: Camera) {
      instance.current?.moveCamera({
        center: { lat: center.latitude, lng: center.longitude },
        ...others
      });
    },
    animateToRegion(region: Region) {
      instance.current?.panTo({
        lat: region.latitude,
        lng: region.longitude
      });
    }
  }));

  // Update region when external state changes
  useUpdateEffect(() => {
    if (!region) return;
    setCenter({ lat: region.latitude, lng: region.longitude });
    setZoom(calcZoom(region.longitudeDelta));
  }, [region]);

  const onLoad = (map: google.maps.Map): void => {
    instance.current = map;
    // force style reapply on mount
    if (customMapStyle) {
      map.setOptions({ styles: customMapStyle });
    }
    onMapReady?.();
  };

  const getCurrentRegion = (): Region => {
    const zoom = instance.current?.getZoom();
    const center = instance.current?.getCenter();
    const delta = zoom == null ? null : zoomReverseDelta(zoom, deltaRatio);
    return {
      latitude: center?.lat() ?? 0,
      latitudeDelta: delta?.latitudeDelta ?? 0,
      longitude: center?.lng() ?? 0,
      longitudeDelta: delta?.longitudeDelta ?? 0
    };
  };

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
        mapContainerStyle={{ height: '100%', width: '100%' }}
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
  );
});

export default MapView;
