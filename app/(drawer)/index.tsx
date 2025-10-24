import { StyleSheet, View, Image, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  SpatialNavigationFocusableView,
  SpatialNavigationRoot,
  SpatialNavigationNode,
  SpatialNavigationVirtualizedList,
  SpatialNavigationVirtualizedListRef,
  DefaultFocus,
} from 'react-tv-space-navigation';
import { Direction } from '@bam.tech/lrud';
import { scaledPixels } from '@/hooks/useScale';
import { useIptvChannels } from '@/hooks/useIptvChannels';
import { useMenuContext } from '../../components/MenuContext';
import { useRouter } from 'expo-router';

const ITEM_SIZE = scaledPixels(190);

type CardData = {
  id: string | number;
  title: string;
  description: string;
  channelLogo: string;
  movie: string;
  referrer?: string | null;
  userAgent?: string | null;
};

export default function IndexScreen() {
  const router = useRouter();
  const styles = useGridStyles();
  const navigation = useNavigation();
  const { isOpen: isMenuOpen, toggleMenu } = useMenuContext();

  // Load first N channels from iptv-org mapped to UI cards
  const { data, loading, error } = useIptvChannels(30);
  const items: CardData[] = useMemo(() => {
    if (!data) return [];
    return data.map((ch, i) => ({
      id: ch.id ?? i,
      title: ch.name ?? ch.id,
      description: ch.streamTitle ?? '',
      channelLogo: ch.logo || '',
      movie: ch.url,
      referrer: ch.referrer ?? null,
      userAgent: ch.userAgent ?? null,
    }));
  }, [data]);

  // Index under D-pad focus (row focus)
  const [focusedIndex, setFocusedIndex] = useState(0);
  // Actually playing channel index (null if none)
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Reset focus & playback when dataset changes
  useEffect(() => {
    setFocusedIndex(0);
    if (!items.length) {
      setCurrentIndex(null);
      setIsPlaying(false);
    }
  }, [items.length]);

  const focusedItem = items[focusedIndex];
  const currentItem = currentIndex != null ? items[currentIndex] : undefined;

  // Open drawer when user presses LEFT on the first tile
  const isActive = !isMenuOpen;
  const onDirectionHandledWithoutMovement = useCallback(
    (movement: Direction) => {
      if (movement === 'left' && focusedIndex === 0) {
        // @ts-ignore
        navigation.openDrawer?.();
        toggleMenu(true);
      }
    },
    [focusedIndex, navigation, toggleMenu],
  );

  // Selecting a tile sets it as the "current" channel and starts playing
  const handleSelectTile = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;
      setCurrentIndex(index);
      setIsPlaying(true);

      // router.push({
      //   pathname: '/details',
      //   params: {
      //     title: item.title,
      //     description: item.description,
      //     headerImage: item.channelLogo,
      //     movie: item.movie,
      //     referrer: item.referrer ?? '',
      //     ua: item.userAgent ?? '',
      //   },
      // });
    },
    [items],
  );

  // Header shows either the currently playing channel or the tile under focus
  const renderHeader = useCallback(() => {
    const header = isPlaying && currentItem ? currentItem : focusedItem;

    return (
      <View style={styles.header}>
        <Image style={[styles.headerImage]} source={require('@/assets/images/video.png')} resizeMode="cover" />
        <Image source={require('@/assets/images/OrkaTVlogo.png')} style={styles.brandLogo} />

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>{header?.title ?? ''}</Text>
          <Text style={styles.headerDescription}>{header?.description ?? ''}</Text>

          <SpatialNavigationFocusableView
            onSelect={() => {
              if (currentItem) {
                setIsPlaying((prev) => {
                  const next = !prev;
                  if (!next) setCurrentIndex(null);
                  return next;
                });
              } else if (focusedItem) {
                setCurrentIndex(focusedIndex);
                setIsPlaying(true);
              }
            }}
          >
            {({ isFocused }) => (
              <View style={[styles.playButton, isFocused && styles.playButtonFocused]}>
                <Image
                  source={isPlaying ? require('@/assets/images/stop.png') : require('@/assets/images/play.png')}
                  style={styles.playIcon}
                />
              </View>
            )}
          </SpatialNavigationFocusableView>
        </View>
      </View>
    );
  }, [currentItem, focusedItem, isPlaying, focusedIndex]);

  const listRef = useRef<SpatialNavigationVirtualizedListRef>(null);

  // Single tile in the horizontal list
  const renderItem = useCallback(
    ({ item, index }: { item: CardData; index: number }) => (
      <SpatialNavigationFocusableView onFocus={() => setFocusedIndex(index)} onSelect={() => handleSelectTile(index)}>
        {({ isFocused }) => {
          const isCurrent = currentIndex === index && isPlaying;
          return (
            <View style={styles.tileWrapper}>
              {isCurrent && <Text style={styles.playingLabel}>Currently Playing</Text>}

              <View
                style={[
                  styles.channelTile,
                  isFocused && styles.channelTileFocused,
                  isCurrent && styles.channelTilePlaying,
                ]}
              >
                <Image
                  source={item.channelLogo ? { uri: item.channelLogo } : require('@/assets/images/channel_icon.png')}
                  style={styles.channelLogoImage}
                />
              </View>
            </View>
          );
        }}
      </SpatialNavigationFocusableView>
    ),
    [styles, currentIndex, isPlaying, handleSelectTile],
  );

  // Simple loading / error full-screen overlays
  if (loading && items.length === 0) {
    return (
      <SpatialNavigationRoot isActive={!isMenuOpen}>
        <View style={styles.centerMsg}>
          <Text style={styles.centerMsgText}>Loading channels…</Text>
        </View>
      </SpatialNavigationRoot>
    );
  }

  if (error && items.length === 0) {
    return (
      <SpatialNavigationRoot isActive={!isMenuOpen}>
        <View style={styles.centerMsg}>
          <Text style={styles.centerMsgText}>Failed to load channels</Text>
          <Text style={styles.centerMsgSub}>{String(error)}</Text>
        </View>
      </SpatialNavigationRoot>
    );
  }

  // Main layout: full-screen header + absolutely anchored horizontal row at the bottom
  return (
    <SpatialNavigationRoot isActive={isActive} onDirectionHandledWithoutMovement={onDirectionHandledWithoutMovement}>
      <View style={styles.container}>
        {renderHeader()}

        <View style={styles.highlightsContainer}>
          <SpatialNavigationNode>
            <DefaultFocus>
              <SpatialNavigationVirtualizedList
                ref={listRef}
                data={items}
                orientation="horizontal"
                renderItem={renderItem}
                itemSize={ITEM_SIZE}
                numberOfRenderedItems={24}
                numberOfItemsVisibleOnScreen={8}
                onEndReachedThresholdItemsNumber={3}
              />
            </DefaultFocus>
          </SpatialNavigationNode>
        </View>
      </View>
    </SpatialNavigationRoot>
  );
}

const useGridStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: 'black', position: 'relative' },
    header: { width: '100%', height: '100%', position: 'relative' },
    headerImage: { width: '100%', height: '100%', opacity: 0.6 },
    brandLogo: {
      position: 'absolute',
      top: scaledPixels(50),
      left: scaledPixels(88),
      width: scaledPixels(130),
      height: scaledPixels(60),
      resizeMode: 'contain',
      zIndex: 3,
    },
    headerTextContainer: {
      position: 'absolute',
      left: scaledPixels(88),
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      width: '50%',
    },
    headerTitle: { color: '#fff', fontSize: scaledPixels(40), fontFamily: 'Montserrat_500Medium', fontWeight: '500' },
    headerDescription: {
      color: '#fff',
      fontSize: scaledPixels(56),
      fontFamily: 'Montserrat_500Medium',
      fontWeight: '500',
      marginTop: scaledPixels(12),
    },
    playButton: {
      marginTop: scaledPixels(20),
      alignSelf: 'flex-start',
      backgroundColor: '#364250',
      paddingVertical: scaledPixels(8),
      paddingHorizontal: scaledPixels(24),
      borderRadius: scaledPixels(24),
    },
    playButtonFocused: { backgroundColor: '#00A0DF' },
    playIcon: { width: scaledPixels(32), height: scaledPixels(32), tintColor: '#fff' },
    highlightsContainer: {
      flex: 1,
      position: 'absolute',
      height: ITEM_SIZE + scaledPixels(40),
      bottom: 0,
      width: '100%',
      paddingLeft: scaledPixels(88),
      paddingTop: scaledPixels(10),
    },
    channelTile: {
      width: scaledPixels(168),
      height: scaledPixels(168),
      marginRight: scaledPixels(10),
      backgroundColor: 'rgba(54,66,80,0.85)',
      borderRadius: scaledPixels(8),
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      borderBottomWidth: scaledPixels(7),
      borderBottomColor: 'rgba(54,66,80,0)',
    },
    channelTileFocused: {
      backgroundColor: '#00B2FF',
      borderBottomWidth: scaledPixels(7),
      borderBottomColor: '#00B2FF',
    },
    channelTilePlaying: {
      borderBottomWidth: scaledPixels(7),
      backgroundColor: '#465565',
      borderBottomColor: '#7F8FA2',
    },
    channelLogoImage: {
      width: '70%',
      height: '70%',
      resizeMode: 'contain',
      opacity: 0.95,
    },
    tileWrapper: {
      width: ITEM_SIZE,
      paddingTop: scaledPixels(26),
    },
    playingLabel: {
      position: 'absolute',
      fontFamily: 'Montserrat_500Medium',
      top: -6,
      color: '#fff',
      fontSize: scaledPixels(19),
      fontWeight: '400',
    },
    centerMsg: { flex: 1, backgroundColor: 'black', alignItems: 'center', justifyContent: 'center' },
    centerMsgText: { color: '#fff', fontSize: scaledPixels(32), marginBottom: scaledPixels(8) },
    centerMsgSub: {
      color: '#9fb2c1',
      fontSize: scaledPixels(20),
      paddingHorizontal: scaledPixels(40),
      textAlign: 'center',
    },
  });
