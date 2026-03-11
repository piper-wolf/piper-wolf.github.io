import { motion } from "motion/react";

function App() {
  return (
    <div
      css={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "20px",
        textAlign: "center",
        height: "100%",
        alignContent: "space-around",
      }}
    >
      <motion.h1
        animate={{ color: ["#F5A9B8", "#5BCEFA"] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "linear",
        }}
      >
        Piper Wolf
      </motion.h1>
      <motion.p
        initial={{ x: -500 }}
        animate={{ x: 0 }}
        transition={{ type: "spring", duration: 2 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
        css={{ cursor: "pointer", userSelect: "none" }}
      >
        The only way to learn is by playing. The only way to win is by learning.
        And the only way to begin is by beginning.
      </motion.p>
      <img src="/frog-spin.gif" />
    </div>
  );
}

export default App;
