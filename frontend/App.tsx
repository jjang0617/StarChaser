import { Text, View } from 'react-native';

// 앱의 메인 컴포넌트 정의하고 외부에서 import 할 수 있게 내보냄
export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-black">
    <Text className="text-white text-2xl font-bold">StarChaser</Text>
  </View>
  );
}
