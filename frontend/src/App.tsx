
import { HashRouter, Route, Routes } from 'react-router';
import Predictor from './Predictor';
import TrainingSuite from './TrainingSuite';

const App = () => {
  return (
    <HashRouter>
        <Routes>
          <Route path="/" element={<Predictor />} />
          <Route path="/train" element={<TrainingSuite />} />
        </Routes>
    </HashRouter>
  );
};

export default App;